import { describe, expect, it } from 'vitest';
import { hasCanadianLocation, isCanadianLocation } from './locations';

describe('isCanadianLocation', () => {
  it.each([
    'Markham, ON, Canada',
    'Remote in Canada',
    'Canada',
    'Ontario, Canada',
    'Kanata, Ottawa, ON, Canada',
    'Québec City, QC, Canada',
    // vansh leaves the country off.
    'Toronto, ON',
    'CAN Kanata, ON',
    // The board feeds write locations their own way.
    'Toronto, Ontario, Canada',
    'Remote Canada',
    'Toronto, Ontario',
    'Remote - Ontario',
    'Toronto',
    'Montréal',
    'Oakville',
  ])('counts %s', (location) => {
    expect(isCanadianLocation(location)).toBe(true);
  });

  it.each([
    'Remote in USA',
    'Stockholm, Sweden',
    'New York, NY',
    'Remote',
    'United States',
    // A Canadian name followed by somewhere else is a different place.
    'New Brunswick, NJ',
    'Vancouver, WA',
    'Waterloo, IA',
    'Ontario, CA',
    // Cities named like a big place elsewhere aren't on the list.
    'London',
    'Victoria',
  ])("doesn't count %s", (location) => {
    expect(isCanadianLocation(location)).toBe(false);
  });
});

describe('hasCanadianLocation', () => {
  it('is true when any location is in Canada', () => {
    expect(hasCanadianLocation(['New York, NY', 'Toronto, ON'])).toBe(true);
    expect(hasCanadianLocation(['New York, NY', 'Remote in USA'])).toBe(false);
  });

  it('is false for a posting with no location', () => {
    expect(hasCanadianLocation([])).toBe(false);
  });
});
