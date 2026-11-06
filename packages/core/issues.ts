import type { z } from 'zod';

/**
 * One line per problem, like `availability.earliest_start: TODO is not allowed`, so a validation
 * failure names every bad path at once instead of stopping at the first.
 */
export function describeIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.map(String).join('.');
    return path === '' ? issue.message : `${path}: ${issue.message}`;
  });
}
