import { readdirSync, readFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { close, listen } from './fake-job-board';
import { FIXTURES_DIR } from './paths';

/**
 * One recorded reply. A request matches when its model equals `match.model` (if given) and its
 * system prompt and messages contain every string in `match.contains`.
 */
const RecordingSchema = z.strictObject({
  match: z.strictObject({
    model: z.string().optional(),
    contains: z.array(z.string().min(1)).min(1),
  }),
  response: z.looseObject({
    content: z.array(z.looseObject({ type: z.string() })),
    stop_reason: z.string().optional(),
  }),
});
export type ClaudeRecording = z.infer<typeof RecordingSchema>;

const RequestSchema = z.looseObject({
  model: z.string(),
  system: z.unknown().optional(),
  messages: z.array(z.looseObject({ role: z.string(), content: z.unknown() })),
});
type MessagesRequest = z.infer<typeof RequestSchema>;

const BatchSchema = z.looseObject({
  requests: z.array(z.looseObject({ custom_id: z.string().min(1), params: RequestSchema })).min(1),
});

export interface FakeClaudeOptions {
  port?: number;
  recordings?: ClaudeRecording[];
  /** How many times a batch answers "in progress" before it has ended. 0 by default. */
  batchPolls?: number;
}

export interface FakeClaude {
  /** Base URL to give the Anthropic SDK, as `baseURL` or `ANTHROPIC_BASE_URL`. */
  url: string;
  /** The model of every request served, in order, whether sent alone or in a batch. */
  requests: { model: string; matched: boolean }[];
  /** Every request body as sent, in the same order as `requests`. */
  bodies: MessagesRequest[];
  /** The ID and size of every batch created, and whether it was cancelled. */
  batches: { id: string; size: number; canceled: boolean }[];
  close(): Promise<void>;
}

/** Loads every `*.json` recording in a folder, by default `fixtures/claude/`. */
export function loadClaudeRecordings(dir = fileURLToPath(new URL('claude/', FIXTURES_DIR))) {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => RecordingSchema.parse(JSON.parse(readFileSync(`${dir}/${name}`, 'utf8'))));
}

/** About four characters a token, which is all the fake needs to make usage look real. */
const tokens = (value: unknown) => Math.ceil(JSON.stringify(value ?? '').length / 4);

/** Haiku 5.5 and Sonnet 5.5 cache prefixes from 512 tokens; a shorter one silently isn't cached. */
const MIN_CACHED_TOKENS = 512;

/**
 * The system blocks up to and including the last one marked `cache_control`: what the real API
 * would cache. Empty when nothing is marked.
 */
function cachedPrefix(request: MessagesRequest): unknown[] {
  if (!Array.isArray(request.system)) return [];
  const blocks = request.system as { cache_control?: unknown }[];
  const last = blocks.findLastIndex((block) => block.cache_control !== undefined);
  return blocks.slice(0, last + 1);
}

interface BatchState {
  id: string;
  results: string[];
  polls: number;
  canceled: boolean;
  size: number;
}

/**
 * A stand-in for the Messages API (`POST /v1/messages`) and the Message Batches API that replays
 * recorded replies. Local dev points the SDK here, so the real adapters run end to end without
 * spending tokens. A request with no matching recording gets a 404 that says so, or an `errored`
 * result inside a batch.
 *
 * Usage is made up from the text's length, and prompt caching is simulated: the first request
 * whose marked system prefix is 512 tokens or more writes it, and every later request with the same
 * prefix reads it. A recording that gives its own `usage` keeps it.
 */
export async function startFakeClaude(options: FakeClaudeOptions = {}): Promise<FakeClaude> {
  const recordings = options.recordings ?? loadClaudeRecordings();
  const requests: FakeClaude['requests'] = [];
  const bodies: FakeClaude['bodies'] = [];
  const batches = new Map<string, BatchState>();
  const cache = new Set<string>();
  let served = 0;
  let url = '';

  /** The reply to one Messages API request, or null when nothing was recorded for it. */
  const answer = (request: MessagesRequest): Record<string, unknown> | null => {
    const text = JSON.stringify([request.system ?? null, request.messages]);
    const recording = recordings.find(
      ({ match }) =>
        (match.model === undefined || match.model === request.model) &&
        match.contains.every((needle) => text.includes(needle)),
    );
    requests.push({ model: request.model, matched: recording !== undefined });
    bodies.push(request);
    if (!recording) return null;

    const prefix = cachedPrefix(request);
    const prefixTokens = prefix.length > 0 ? tokens(prefix) : 0;
    const cached =
      prefixTokens >= MIN_CACHED_TOKENS ? JSON.stringify([request.model, prefix]) : null;
    const hit = cached !== null && cache.has(cached);
    if (cached !== null) cache.add(cached);
    served += 1;
    return {
      id: `msg_fake_${String(served)}`,
      type: 'message',
      role: 'assistant',
      model: request.model,
      stop_reason: 'end_turn',
      stop_sequence: null,
      stop_details: null,
      usage: {
        input_tokens: tokens(text) - (cached !== null ? prefixTokens : 0),
        output_tokens: tokens(recording.response.content),
        cache_read_input_tokens: hit ? prefixTokens : 0,
        cache_creation_input_tokens: cached !== null && !hit ? prefixTokens : 0,
      },
      ...recording.response,
    };
  };

  const batchView = (batch: BatchState) => {
    const ended = batch.canceled || batch.polls <= 0;
    return {
      id: batch.id,
      type: 'message_batch',
      processing_status: batch.canceled ? 'canceling' : ended ? 'ended' : 'in_progress',
      request_counts: {
        processing: ended ? 0 : batch.size,
        succeeded: ended ? batch.results.filter((r) => r.includes('"succeeded"')).length : 0,
        errored: ended ? batch.results.filter((r) => r.includes('"errored"')).length : 0,
        canceled: 0,
        expired: 0,
      },
      created_at: '2026-11-07T14:00:00Z',
      expires_at: '2026-11-08T14:00:00Z',
      ended_at: ended ? '2026-11-07T14:01:00Z' : null,
      cancel_initiated_at: batch.canceled ? '2026-11-07T14:01:00Z' : null,
      archived_at: null,
      results_url: ended ? `${url}/v1/messages/batches/${batch.id}/results` : null,
    };
  };

  const routes = async (req: IncomingMessage, res: ServerResponse) => {
    const reply = (status: number, body: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    const path = new URL(req.url ?? '/', 'http://fake').pathname;
    const batchPath = /^\/v1\/messages\/batches\/([\w-]+)(\/results|\/cancel)?$/.exec(path);

    if (req.method === 'POST' && path === '/v1/messages') {
      const parsed = RequestSchema.safeParse(await readJson(req));
      if (!parsed.success) {
        reply(400, apiError('invalid_request_error', parsed.error.message));
        return;
      }
      const message = answer(parsed.data);
      if (message) reply(200, message);
      else
        reply(
          404,
          apiError('not_found_error', 'the fake Claude has no recording for this request'),
        );
      return;
    }

    if (req.method === 'POST' && path === '/v1/messages/batches') {
      const parsed = BatchSchema.safeParse(await readJson(req));
      if (!parsed.success) {
        reply(400, apiError('invalid_request_error', parsed.error.message));
        return;
      }
      const results = parsed.data.requests.map(({ custom_id, params }) => {
        const message = answer(params);
        return JSON.stringify({
          custom_id,
          result: message
            ? { type: 'succeeded', message }
            : {
                type: 'errored',
                error: {
                  type: 'error',
                  error: { type: 'not_found_error', message: 'no recording for this request' },
                },
              },
        });
      });
      const id = `msgbatch_fake_${String(batches.size + 1)}`;
      const batch: BatchState = {
        id,
        results,
        polls: options.batchPolls ?? 0,
        canceled: false,
        size: results.length,
      };
      batches.set(id, batch);
      reply(200, { ...batchView(batch), processing_status: 'in_progress', results_url: null });
      return;
    }

    const batch = batchPath ? batches.get(batchPath[1] ?? '') : undefined;
    if (batchPath && !batch) {
      reply(404, apiError('not_found_error', `no batch ${batchPath[1] ?? ''}`));
      return;
    }
    if (batch && req.method === 'GET' && batchPath?.[2] === undefined) {
      const view = batchView(batch);
      batch.polls -= 1;
      reply(200, view);
      return;
    }
    if (batch && req.method === 'GET' && batchPath?.[2] === '/results') {
      res.writeHead(200, { 'content-type': 'application/binary' });
      res.end(batch.canceled ? '' : `${batch.results.join('\n')}\n`);
      return;
    }
    if (batch && req.method === 'POST' && batchPath?.[2] === '/cancel') {
      batch.canceled = true;
      reply(200, batchView(batch));
      return;
    }
    reply(
      404,
      apiError(
        'not_found_error',
        'the fake Claude only serves /v1/messages and /v1/messages/batches',
      ),
    );
  };

  const server = createServer((req, res) => {
    routes(req, res).catch(() => {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify(apiError('invalid_request_error', 'the body is not JSON')));
    });
  });

  url = await listen(server, options.port ?? 0);
  return {
    url,
    requests,
    bodies,
    get batches() {
      return [...batches.values()].map(({ id, size, canceled }) => ({ id, size, canceled }));
    },
    close: () => close(server),
  };
}

function apiError(type: string, message: string) {
  return { type: 'error', error: { type, message } };
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
