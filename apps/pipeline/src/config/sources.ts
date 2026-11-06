// Reads sources/sources.yaml: which lists and job-board feeds the daily run polls.
import { readFile } from 'node:fs/promises';
import type { GitHubListConfig } from '@scout/adapters';
import { describeIssues } from '@scout/core';
import { parse } from 'yaml';
import { z } from 'zod';

const GitHubListEntrySchema = z.strictObject({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/, 'a lowercase name like "simplify"'),
  repo: z.string().regex(/^[^/\s]+\/[^/\s]+$/, 'an "owner/repo" on GitHub'),
  path: z.string().min(1),
  branch: z.string().min(1),
  fallback_branch: z.string().min(1).nullable().default('main'),
  term_field: z.enum(['terms', 'season']),
  resolve_short_links: z.boolean().default(false),
  certain_years: z.record(z.string().min(1), z.int().min(2020).max(2100)).default({}),
});

const SourcesFileSchema = z.strictObject({
  github_lists: z.array(GitHubListEntrySchema).min(1),
  /** Job-board feed URLs by board, used by #6. */
  ats_feeds: z.record(z.string(), z.string()).default({}),
});

export interface SourcesConfig {
  githubLists: GitHubListConfig[];
  atsFeeds: Record<string, string>;
}

/** Reads and checks the file, naming every problem at once. */
export async function loadSources(path: string): Promise<SourcesConfig> {
  const parsed = SourcesFileSchema.safeParse(parse(await readFile(path, 'utf8')));
  if (!parsed.success) {
    throw new Error(`${path} has problems:\n${describeIssues(parsed.error).join('\n')}`);
  }
  return {
    githubLists: parsed.data.github_lists.map((entry) => ({
      name: entry.name,
      repo: entry.repo,
      path: entry.path,
      branch: entry.branch,
      fallbackBranch: entry.fallback_branch,
      termField: entry.term_field,
      resolveShortLinks: entry.resolve_short_links,
      certainYears: entry.certain_years,
    })),
    atsFeeds: parsed.data.ats_feeds,
  };
}
