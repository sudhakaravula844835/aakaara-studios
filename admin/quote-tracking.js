// Shared database handoff; keep this separate from PDF rendering and Gmail.
export function quoteProjectPayload(state, pricing) {
  const clientName = state.clientName?.trim();
  if (!clientName) throw new Error('Enter a client name before sending.');
  if (!Number.isFinite(pricing.total) || pricing.total < 0) throw new Error('Enter a valid quote price.');
  const venue = [state.venueName, state.location].filter(Boolean).join(', ');
  return {
    client_name: clientName,
    client_email: state.clientEmail?.trim() || null,
    client_phone: state.clientPhone?.trim() || null,
    package_tier: state.eventType || null,
    hours_booked: pricing.totalHours,
    quoted_price: pricing.total,
    events: (state.days || []).flatMap(day => {
      const events = day.events?.filter(event => event.name?.trim()) || [];
      return (events.length ? events : [{ name: state.eventType || 'Event' }]).map(event => ({
        name: event.name.trim(), event_date: day.date || null, venue: venue || null,
      }));
    }),
  };
}

// A tracking ID is only safe to reuse while it still points at the quote it
// was minted for. Once a send has succeeded, the caller records the payload
// it sent as `previousSnapshot`; if the next send's content differs, the
// caller must mint a fresh ID rather than reuse one that would silently
// resolve to the earlier client's row (create_quote_project dedupes by ID
// alone, so a stale ID never creates a second row). A null/undefined
// snapshot means nothing has been sent yet under the current ID, so it's
// always safe to keep it.
export function hasQuoteChangedSinceLastSend(previousSnapshot, state, pricing) {
  if (previousSnapshot == null) return false;
  return previousSnapshot !== JSON.stringify(quoteProjectPayload(state, pricing));
}

export async function trackQuote(client, quoteId, state, pricing) {
  const { data: auth, error: authError } = await client.auth.getSession();
  if (authError || !auth?.session) throw new Error('Sign in to the Board, then return here and try again. Your draft is saved.');
  const { data, error } = await client.rpc('create_quote_project', {
    p_quote_id: quoteId, p_quote: quoteProjectPayload(state, pricing),
  });
  if (error || !data) throw new Error('Could not save the quote to the Board. Your draft is saved; please retry.');
  return data;
}
