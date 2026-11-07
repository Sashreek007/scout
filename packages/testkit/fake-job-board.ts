import { readFile, stat } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { FIXTURES_DIR } from './paths';

const CONTENT_TYPES: Record<string, string> = {
  '.json': 'application/json; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

/** A response a test scripts for one path, to stand in for redirects, outages and slow servers. */
export interface FakeResponse {
  status?: number;
  headers?: Record<string, string>;
  body?: string;
  /** Wait this long before answering. */
  delayMs?: number;
}

export interface FakeJobBoard {
  /** Base URL, like `http://127.0.0.1:4318`. */
  url: string;
  /** Every path requested, in order, so a test can check what was fetched. */
  requests: string[];
  /** The user agent of every request, in the same order as `requests`. */
  userAgents: string[];
  /** The fake URL for a real one: `https://api.lever.co/v0/x` becomes `{url}/api.lever.co/v0/x`. */
  rewrite: (realUrl: string) => string;
  /**
   * Answers the next requests to a path (or a real URL's path) with these responses, in order.
   * Once they run out, the path is served from its fixture again.
   */
  script(pathOrUrl: string, responses: FakeResponse[]): void;
  close(): Promise<void>;
}

/**
 * Serves saved job-board responses from `fixtures/board/{host}/{path}`, so sources, readers and
 * fillers run against real-shaped data with no network (docs/workflow.md: no live job boards in CI).
 * A path is looked up as is, then with `.json`, then with `.html`, each also as a `.gz` that is
 * served decompressed. The query string is ignored.
 */
export async function startFakeJobBoard(
  options: { port?: number; root?: string } = {},
): Promise<FakeJobBoard> {
  const root = options.root ?? fileURLToPath(new URL('board/', FIXTURES_DIR));
  const requests: string[] = [];
  const userAgents: string[] = [];
  const scripts = new Map<string, FakeResponse[]>();

  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://fake').pathname);
    requests.push(path);
    userAgents.push(req.headers['user-agent'] ?? '');

    const scripted = scripts.get(path)?.shift();
    if (scripted) {
      setTimeout(() => {
        res.writeHead(scripted.status ?? 200, scripted.headers ?? {});
        res.end(scripted.body ?? '');
      }, scripted.delayMs ?? 0);
      return;
    }

    void findFixture(root, path).then(
      async (file) => {
        if (!file || req.method !== 'GET') {
          res.writeHead(404, { 'content-type': CONTENT_TYPES['.json'] });
          res.end(JSON.stringify({ error: 'not found', path }));
          return;
        }
        const gzipped = file.endsWith('.gz');
        const name = gzipped ? file.slice(0, -3) : file;
        const bytes = await readFile(file);
        res.writeHead(200, { 'content-type': CONTENT_TYPES[extname(name)] ?? 'text/plain' });
        res.end(gzipped ? gunzipSync(bytes) : bytes);
      },
      (error: unknown) => {
        res.writeHead(500);
        res.end(String(error));
      },
    );
  });

  const url = await listen(server, options.port ?? 0);
  const pathOf = (pathOrUrl: string) => {
    if (pathOrUrl.startsWith('/')) return pathOrUrl;
    const real = new URL(pathOrUrl);
    return `/${real.host}${real.pathname}`;
  };
  return {
    url,
    requests,
    userAgents,
    rewrite: (realUrl) => {
      const real = new URL(realUrl);
      return `${url}/${real.host}${real.pathname}${real.search}`;
    },
    script: (pathOrUrl, responses) => {
      const path = pathOf(pathOrUrl);
      scripts.set(path, [...(scripts.get(path) ?? []), ...responses]);
    },
    close: () => close(server),
  };
}

async function findFixture(root: string, path: string): Promise<string | null> {
  const base = normalize(join(root, path));
  // Never serve anything outside the fixtures folder.
  if (!base.startsWith(root.endsWith(sep) ? root : root + sep)) return null;
  for (const name of [base, `${base}.json`, `${base}.html`]) {
    for (const candidate of [name, `${name}.gz`]) {
      const info = await stat(candidate).catch(() => null);
      if (info?.isFile()) return candidate;
    }
  }
  return null;
}

export function listen(server: Server, port: number): Promise<string> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        reject(new Error('the server has no TCP address'));
        return;
      }
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

export function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}
