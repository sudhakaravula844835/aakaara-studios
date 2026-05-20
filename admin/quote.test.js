import { describe, it, expect } from 'vitest';
import {
  parseDurationToHours,
  sumEventPhotos,
  generateQuoteRef,
  calculatePricingSummary,
  computeInvestmentBoxHeight,
  migrateEventDay,
} from './quote-utils.js';

describe('parseDurationToHours', () => {
  it('parses "3 Hours"', () => expect(parseDurationToHours('3 Hours')).toBe(3));
  it('parses "2.5 hrs"', () => expect(parseDurationToHours('2.5 hrs')).toBe(2.5));
  it('parses "4 hour"', () => expect(parseDurationToHours('4 hour')).toBe(4));
  it('converts 90 min to 1.5', () => expect(parseDurationToHours('90 min')).toBe(1.5));
  it('converts 90 minutes', () => expect(parseDurationToHours('90 minutes')).toBe(1.5));
  it('returns 0 for empty string', () => expect(parseDurationToHours('')).toBe(0));
  it('returns 0 for non-numeric', () => expect(parseDurationToHours('TBD')).toBe(0));
  it('returns 0 for null', () => expect(parseDurationToHours(null)).toBe(0));
});

describe('sumEventPhotos', () => {
  it('sums mixed values', () => expect(sumEventPhotos([{ photos: '100' }, { photos: '200' }, { photos: '' }])).toBe(300));
  it('returns 0 for all blank', () => expect(sumEventPhotos([{ photos: '' }, { photos: '' }])).toBe(0));
  it('handles single value', () => expect(sumEventPhotos([{ photos: '400' }])).toBe(400));
  it('ignores non-numeric', () => expect(sumEventPhotos([{ photos: 'TBD' }, { photos: '100' }])).toBe(100));
  it('returns 0 for empty array', () => expect(sumEventPhotos([])).toBe(0));
});

describe('generateQuoteRef', () => {
  const yr = new Date().getFullYear();
  it('starts at 001 when no refs', () => expect(generateQuoteRef([])).toBe(`AAS-${yr}-001`));
  it('increments past existing refs', () => expect(generateQuoteRef([`AAS-${yr}-001`, `AAS-${yr}-002`])).toBe(`AAS-${yr}-003`));
  it('handles three-digit rollover', () => expect(generateQuoteRef([`AAS-${yr}-099`])).toBe(`AAS-${yr}-100`));
  it('resets to 001 when only prior-year refs exist', () => expect(generateQuoteRef(['AAS-2020-047'])).toBe(`AAS-${yr}-001`));
  it('zero-pads single digit', () => expect(generateQuoteRef([`AAS-${yr}-009`])).toBe(`AAS-${yr}-010`));
});

describe('calculatePricingSummary', () => {
  const twoHourlyDays = [
    { hours: 6, events: [] },
    { hours: 8, events: [] },
  ];
  it('hourly: sums hours and multiplies by rate', () => {
    const r = calculatePricingSummary(twoHourlyDays, { model: 'hourly', hourlyRate: 300, flatRate: 0, travelType: 'none', travelAmount: 0, retainerFee: 0 });
    expect(r.totalHours).toBe(14);
    expect(r.baseTotal).toBe(4200);
    expect(r.total).toBe(4200);
  });
  it('flat rate: ignores hours', () => {
    const r = calculatePricingSummary(twoHourlyDays, { model: 'flat', hourlyRate: 300, flatRate: 5000, travelType: 'none', travelAmount: 0, retainerFee: 0 });
    expect(r.baseTotal).toBe(5000);
    expect(r.total).toBe(5000);
  });
  it('adds fixed travel amount', () => {
    const r = calculatePricingSummary(twoHourlyDays, { model: 'hourly', hourlyRate: 300, flatRate: 0, travelType: 'fixed', travelAmount: 400, retainerFee: 0 });
    expect(r.total).toBe(4600);
  });
  it('separate travel does not change total', () => {
    const r = calculatePricingSummary(twoHourlyDays, { model: 'hourly', hourlyRate: 300, flatRate: 0, travelType: 'separate', travelAmount: 400, retainerFee: 0 });
    expect(r.total).toBe(4200);
  });
  it('adds retainer fee to total', () => {
    const r = calculatePricingSummary(twoHourlyDays, { model: 'hourly', hourlyRate: 300, flatRate: 0, travelType: 'none', travelAmount: 0, retainerFee: 500 });
    expect(r.total).toBe(4700);
  });
  it('zero hours produces 0 total not NaN', () => {
    const r = calculatePricingSummary([], { model: 'hourly', hourlyRate: 300, flatRate: 0, travelType: 'none', travelAmount: 0, retainerFee: 0 });
    expect(r.total).toBe(0);
    expect(Number.isNaN(r.total)).toBe(false);
  });
});

describe('computeInvestmentBoxHeight', () => {
  it('1 day hourly returns base height', () => {
    const pricing = { model: 'hourly', dayBreakdown: [{ label: 'Day 1', hours: 6, amount: 1800 }] };
    expect(computeInvestmentBoxHeight(pricing, false)).toBe(66);
  });
  it('8 days hourly returns larger height', () => {
    const breakdown = Array.from({ length: 8 }, (_, i) => ({ label: `Day ${i + 1}`, hours: 6, amount: 1800 }));
    const pricing = { model: 'hourly', dayBreakdown: breakdown };
    expect(computeInvestmentBoxHeight(pricing, false)).toBeGreaterThan(72);
  });
  it('flat rate returns minimum height', () => {
    const pricing = { model: 'flat', dayBreakdown: [] };
    expect(computeInvestmentBoxHeight(pricing, false)).toBe(66);
  });
});
