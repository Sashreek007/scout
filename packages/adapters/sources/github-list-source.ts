import {
  ListingSchema,
  TermSchema,
  type JobSource,
  type Listing,
  type SourceBatch,
} from '@scout/core';
import { z } from 'zod';
import { HttpError, type HttpClient } from '../http/http-client';
import type { LinkResolver } from '../http/link-resolver';
import { mapWithLimit } from './map-with-limit';

/** One entry of `github_lists` in sources/sources.yaml. */
export interface GitHubListConfig {
  /** The source name stored on each listing, like `simplify`. */
  name: string;
  /** `owner/repo` on GitHub. */
  repo: string;
  path: string;
  branch: string;
  /** Tried when `branch` answers 404. */
  fallbackBranch: string | null;
  /** Simplify lists terms like "Summer 2027"; vansh lists a season with no year. */
  termField: 'terms' | 'season';
  resolveShortLinks: boolean;
  /** Seasons whose year is certain for this list, like `{ Summer: 2027 }` for a Summer 2027 list. */
  certainYears: Record<string, number>;
}

export interface GitHubListDeps {
  http: HttpClient;
  resolver?: LinkResolver;
  /** raw.githubusercontent.com by default; tests point it at the fake job board. */
  baseUrl?: string;
  /** Short links already followed, from the stored jobs, so each is followed only once. */
  knownLinks?: ReadonlyMap<string, string>;
  /** Which listings are worth following, for example only Canadian ones. All by default. */
  shouldResolve?: (listing: Listing) => boolean;
  /** Short links followed at once. 8 by default. */
  concurrency?: number;
}

const BaseRowSchema = z.looseObject({
  company_name: z.string().trim().min(1),
  title: z.string().trim().min(1),
  locations: z.array(z.string()),
  url: z.url(),
  active: z.boolean(),
  is_visible: z.boolean().optional(),
  date_posted: z.int().nonnegative(),
});
const SimplifyRowSchema = BaseRowSchema.extend({ terms: z.array(z.string()) });
const SeasonRowSchema = BaseRowSchema.extend({ season: z.string() });
type Row = z.infer<typeof BaseRowSchema> & { terms?: string[]; season?: string };

/**
 * Reads one of the public GitHub internship lists (#5). Every raw row is checked; bad rows are
 * counted and skipped. Only active rows that aren't hidden become listings. Short links, like
 * vansh's, are followed to the real apply URL, at most once each.
 */
export class GitHubListSource implements JobSource {
  readonly id: string;
  readonly #config: GitHubListConfig;
  readonly #deps: GitHubListDeps;

  constructor(config: GitHubListConfig, deps: GitHubListDeps) {
    this.id = config.name;
    this.#config = config;
    this.#deps = deps;
  }

  async fetch(): Promise<SourceBatch> {
    const raw = await this.#download();
    if (!Array.isArray(raw)) throw new Error(`${this.id}: listings.json is not a list`);

    const schema = this.#config.termField === 'terms' ? SimplifyRowSchema : SeasonRowSchema;
    let invalid = 0;
    const listings: Listing[] = [];
    for (const value of raw) {
      const parsed = schema.safeParse(value);
      if (!parsed.success) {
        invalid += 1;
        continue;
      }
      const row = parsed.data as Row;
      if (!row.active || row.is_visible === false) continue;
      const listing = ListingSchema.safeParse(this.#toListing(row));
      if (listing.success) listings.push(listing.data);
      else invalid += 1;
    }

    return {
      listings: this.#config.resolveShortLinks ? await this.#followLinks(listings) : listings,
      fetched: raw.length,
      invalid,
      skipped: [],
    };
  }

  async #download(): Promise<unknown> {
    const { repo, path, branch, fallbackBranch } = this.#config;
    const base = this.#deps.baseUrl ?? 'https://raw.githubusercontent.com';
    const url = (b: string) => `${base}/${repo}/${b}/${path}`;
    try {
      return await this.#deps.http.getJson(url(branch));
    } catch (error) {
      if (error instanceof HttpError && error.status === 404 && fallbackBranch) {
        try {
          return await this.#deps.http.getJson(url(fallbackBranch));
        } catch (fallbackError) {
          throw new Error(`${this.id}: ${(fallbackError as Error).message}`, {
            cause: fallbackError,
          });
        }
      }
      throw new Error(`${this.id}: ${(error as Error).message}`, { cause: error });
    }
  }

  #toListing(row: Row): Listing {
    const { rawTerm, terms } = this.#terms(row);
    return {
      source: this.id,
      company: row.company_name.trim(),
      title: row.title.trim(),
      locations: row.locations.map((l) => l.trim()).filter((l) => l !== ''),
      rawTerm,
      terms,
      applyUrl: row.url,
      sourceUrl: row.url,
      unresolvedUrl: false,
      postedAt: new Date(row.date_posted * 1000),
      description: null,
    };
  }

  #terms(row: Row): { rawTerm: string | null; terms: string[] } {
    if (this.#config.termField === 'terms') {
      const listed = row.terms ?? [];
      const terms = [...new Set(listed.filter((t) => TermSchema.safeParse(t).success))];
      return { rawTerm: listed.length > 0 ? listed.join(', ') : null, terms };
    }
    const season = row.season?.trim() ?? '';
    if (season === '') return { rawTerm: null, terms: [] };
    const year = this.#config.certainYears[season];
    const term = year === undefined ? null : `${season} ${String(year)}`;
    return {
      rawTerm: season,
      terms: term !== null && TermSchema.safeParse(term).success ? [term] : [],
    };
  }

  async #followLinks(listings: Listing[]): Promise<Listing[]> {
    const { resolver, knownLinks, shouldResolve } = this.#deps;
    return mapWithLimit(listings, this.#deps.concurrency ?? 8, async (listing) => {
      const known = knownLinks?.get(listing.sourceUrl);
      if (known) return { ...listing, applyUrl: known };
      const resolved =
        resolver && (shouldResolve?.(listing) ?? true)
          ? await resolver.resolve(listing.sourceUrl)
          : null;
      return resolved
        ? { ...listing, applyUrl: resolved }
        : { ...listing, unresolvedUrl: true };
    });
  }
}
