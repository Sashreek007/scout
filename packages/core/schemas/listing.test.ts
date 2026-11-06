import { describe, expect, it } from 'vitest';
import { ListingSchema } from './listing';

const listing = {
  source: 'simplify',
  company: 'Northwind Robotics',
  title: 'Software Developer Intern',
  locations: ['Toronto, ON, Canada'],
  rawTerm: 'Winter 2027',
  terms: ['Winter 2027'],
  applyUrl: 'https://job-boards.greenhouse.io/northwind/jobs/4100001',
  unresolvedUrl: false,
  postedAt: '2026-11-01T00:00:00Z',
  description: null,
};

describe('ListingSchema', () => {
  it('parses a listing from a GitHub list', () => {
    const parsed = ListingSchema.parse(listing);
    expect(parsed.postedAt).toEqual(new Date('2026-11-01T00:00:00Z'));
    expect(parsed.terms).toEqual(['Winter 2027']);
  });

  it('rejects a listing without an apply URL', () => {
    const result = ListingSchema.safeParse({ ...listing, applyUrl: 'not a url' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['applyUrl']);
  });

  it('rejects a term it cannot be sure of; that stays in rawTerm', () => {
    expect(ListingSchema.safeParse({ ...listing, terms: ['Winter'] }).success).toBe(false);
  });
});
