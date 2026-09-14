import { describe, it, expect, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createTestProfile, deleteTestProfile, adminClient } from './helpers.js';

// Requires the quote_tracking migration on the configured test database.
describe('quote tracking RPC', () => {
  const profiles = [];
  const quoteIds = [];
  async function profile(role) {
    const result = await createTestProfile(role);
    profiles.push(result);
    return result;
  }
  function quoteId() {
    const id = randomUUID();
    quoteIds.push(id);
    return id;
  }
  const payload = {
    client_name: 'Quote Test Client', quoted_price: 2500,
    events: [{ name: 'Wedding', event_date: '2027-05-20', venue: 'New York' }],
  };
  afterEach(async () => {
    for (const id of quoteIds.splice(0)) await adminClient.from('projects').delete().eq('source_quote_id', id);
    for (const item of profiles.splice(0)) await deleteTestProfile(item.id);
  });

  it.each(['owner', 'pm'])('%s creates quote and events, then retries without changing confirmed terms', async role => {
    const { client } = await profile(role);
    const id = quoteId();
    const { data: projectId, error } = await client.rpc('create_quote_project', { p_quote_id: id, p_quote: payload });
    expect(error).toBeNull();
    const { data: initial } = await client.from('projects').select('stage,quoted_price,confirmed_price').eq('id', projectId).single();
    expect(initial).toEqual({ stage: 'quote_sent', quoted_price: 2500, confirmed_price: null });
    const { error: updateError } = await client.from('projects').update({ stage: 'booked', confirmed_price: 2200 }).eq('id', projectId);
    expect(updateError).toBeNull();
    const { data: retryId, error: retryError } = await client.rpc('create_quote_project', { p_quote_id: id, p_quote: { ...payload, quoted_price: 9000 } });
    expect(retryError).toBeNull();
    expect(retryId).toBe(projectId);
    const { data: final } = await client.from('projects').select('stage,quoted_price,confirmed_price').eq('id', projectId).single();
    expect(final).toEqual({ stage: 'booked', quoted_price: 2500, confirmed_price: 2200 });
    const { data: events } = await client.from('sub_events').select('name,event_date,venue').eq('project_id', projectId);
    expect(events).toEqual(payload.events);
  });

  it('database rejects confirming a tracked quote without a valid agreed price', async () => {
    const { client } = await profile('owner');
    const { data: projectId, error } = await client.rpc('create_quote_project', { p_quote_id: quoteId(), p_quote: payload });
    expect(error).toBeNull();
    for (const price of [null, -1, 'NaN', 'Infinity']) {
      const { error: updateError } = await client.from('projects').update({ stage: 'booked', confirmed_price: price }).eq('id', projectId);
      expect(updateError).not.toBeNull();
    }
    const { data } = await client.from('projects').select('stage,confirmed_price').eq('id', projectId).single();
    expect(data).toEqual({ stage: 'quote_sent', confirmed_price: null });
  });

  it('concurrent retries create one project and one set of events', async () => {
    const { client } = await profile('owner');
    const id = quoteId();
    const results = await Promise.all([1, 2].map(() => client.rpc('create_quote_project', { p_quote_id: id, p_quote: payload })));
    for (const result of results) expect(result.error).toBeNull();
    expect(results[0].data).toBe(results[1].data);
    const { data } = await client.from('sub_events').select('id').eq('project_id', results[0].data);
    expect(data).toHaveLength(1);
  });

  it('rejects invalid prices and rolls back a project when an event is invalid', async () => {
    const { client } = await profile('owner');
    for (const invalid of [
      { ...payload, quoted_price: -1 }, { ...payload, quoted_price: 'Infinity' },
      { ...payload, client_name: ' ' },
      { ...payload, events: [...payload.events, { name: 'Invalid', event_date: 'not-a-date' }] },
    ]) {
      const id = quoteId();
      const { error } = await client.rpc('create_quote_project', { p_quote_id: id, p_quote: invalid });
      expect(error).not.toBeNull();
      const { data } = await adminClient.from('projects').select('id').eq('source_quote_id', id);
      expect(data).toHaveLength(0);
    }
  });

  it('rejects editors and deactivated owners', async () => {
    for (const role of ['editor', 'owner']) {
      const item = await profile(role);
      if (role === 'owner') {
        const { error } = await adminClient.from('profiles').update({ active: false }).eq('id', item.id);
        expect(error).toBeNull();
      }
      const { error } = await item.client.rpc('create_quote_project', { p_quote_id: quoteId(), p_quote: payload });
      expect(error).not.toBeNull();
    }
  });
});
