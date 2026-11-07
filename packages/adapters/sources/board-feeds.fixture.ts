// The three feed URLs from `ats_feeds` in sources/sources.yaml, for the board source tests. The
// pipeline's tests load the real file and check it names these same URLs.
import type { BoardAts } from '@scout/core';

export const FEEDS: Record<BoardAts, string> = {
  greenhouse: 'https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true',
  lever: 'https://api.lever.co/v0/postings/{token}?mode=json',
  ashby: 'https://api.ashbyhq.com/posting-api/job-board/{token}?includeCompensation=true',
};

/** The real URL a board source requests for one board. */
export const feedFor = (ats: BoardAts, token: string) => FEEDS[ats].replace('{token}', token);
