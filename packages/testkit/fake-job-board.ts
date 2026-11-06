import { readFile, stat } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIXTURES_DIR } from './paths';

const CONTENT_TYPES: Record<string, string> = {
  '.json': 'application/json; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

export interface FakeJobBoard {
  /** Base URL, like `http://127.0.0.1:4318`. */
  url: string;
  /** Every path requested, in order, so a test can check what was fetched. */
  requests: string[];
  /** The fake URL for a real one: `https://api.lever.co/v0/x` becomes `{url}/api.lever.co/v0/x`. */
  rewrite(realUrl: string): string;
  close(): Promise<void>;
}

/**
 * Serves saved job-board responses from `fixtures/board/{host}/{path}`, so sources, readers and
 * fillers run against real-shaped data with no network (docs/workflow.md: no live job boards in CI).
 * A path is looked up as is, then with `.json`, then with `.html`. The query string is ignored.
 */
export async function startFakeJobBoard(
  options: { port?: number; root?: string } = {},
): Promise<FakeJobBoard> {
  const root = options.root ?? fileURLToPath(new URL('board/', FIXTURES_DIR));
  const requests: string[] = [];

  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://fake').pathname);
    requests.push(path);
    void findFixture(root, path).then(
      async (file) => {
        if (!file || req.method !== 'GET') {
          res.writeHead(404, { 'content-type': CONTENT_TYPES['.json'] });
          res.end(JSON.stringify({ error: 'not found', path }));
          return;
        }
        res.writeHead(200, { 'content-type': CONTENT_TYPES[extname(file)] ?? 'text/plain' });
        res.end(await readFile(file));
      },
      (error: unknown) => {
        res.writeHead(500);
        res.end(String(error));
      },
    );
  });

  const url = await listen(server, options.port ?? 0);
  return {
    url,
    requests,
    rewrite: (realUrl) => {
      const real = new URL(realUrl);
      return `${url}/${real.host}${real.pathname}${real.search}`;
    },
    close: () => close(server),
  };
}

async function findFixture(root: string, path: string): Promise<string | null> {
  const base = normalize(join(root, path));
  // Never serve anything outside the fixtures folder.
  if (!base.startsWith(root.endsWith(sep) ? root : root + sep)) return null;
  for (const candidate of [base, `${base}.json`, `${base}.html`]) {
    const info = await stat(candidate).catch(() => null);
    if (info?.isFile()) return candidate;
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
