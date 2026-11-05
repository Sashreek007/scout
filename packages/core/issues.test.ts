import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { describeIssues } from './issues';

describe('describeIssues', () => {
  it('names every bad path with its message', () => {
    const schema = z.object({ a: z.object({ b: z.string() }), c: z.number() });
    const result = schema.safeParse({ a: { b: 1 }, c: 'x' });
    expect(describeIssues(result.error!)).toEqual([
      'a.b: Invalid input: expected string, received number',
      'c: Invalid input: expected number, received string',
    ]);
  });

  it('leaves out the path for a problem with the whole value', () => {
    const result = z.string().safeParse(3);
    expect(describeIssues(result.error!)).toEqual([
      'Invalid input: expected string, received number',
    ]);
  });
});
