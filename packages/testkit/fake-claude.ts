import { readdirSync, readFileSync } from 'node:fs';
import { createServer, type IncomingMessage } from 'node:http';
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

export interface FakeClaude {
  /** Base URL to give the Anthropic SDK, as `baseURL` or `ANTHROPIC_BASE_URL`. */
  url: string;
  /** The model of every request served, in order. */
  requests: { model: string; matched: boolean }[];
  close(): Promise<void>;
}

/** Loads every `*.json` recording in a folder, by default `fixtures/claude/`. */
export function loadClaudeRecordings(dir = fileURLToPath(new URL('claude/', FIXTURES_DIR))) {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => RecordingSchema.parse(JSON.parse(readFileSync(`${dir}/${name}`, 'utf8'))));
}

/**
 * A stand-in for the Messages API (`POST /v1/messages`) that replays recorded replies. Local dev
 * points the SDK here, so the real adapters run end to end without spending tokens. A request
 * with no matching recording gets a 404 that says so.
 */
export async function startFakeClaude(
  options: { port?: number; recordings?: ClaudeRecording[] } = {},
): Promise<FakeClaude> {
  const recordings = options.recordings ?? loadClaudeRecordings();
  const requests: FakeClaude['requests'] = [];
  let served = 0;

  const server = createServer((req, res) => {
    const reply = (status: number, body: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    const path = new URL(req.url ?? '/', 'http://fake').pathname;
    if (req.method !== 'POST' || path !== '/v1/messages') {
      reply(404, apiError('not_found_error', `the fake Claude only serves POST /v1/messages`));
      return;
    }
    void readJson(req).then(
      (json) => {
        const parsed = RequestSchema.safeParse(json);
        if (!parsed.success) {
          reply(400, apiError('invalid_request_error', parsed.error.message));
          return;
        }
        const request = parsed.data;
        const text = JSON.stringify([request.system ?? null, request.messages]);
        const recording = recordings.find(
          ({ match }) =>
            (match.model === undefined || match.model === request.model) &&
            match.contains.every((needle) => text.includes(needle)),
        );
        requests.push({ model: request.model, matched: recording !== undefined });
        if (!recording) {
          reply(
            404,
            apiError('not_found_error', 'the fake Claude has no recording for this request'),
          );
          return;
        }
        served += 1;
        reply(200, {
          id: `msg_fake_${served}`,
          type: 'message',
          role: 'assistant',
          model: request.model,
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: {
            input_tokens: 0,
            output_tokens: 0,
            cache_read_input_tokens: 0,
            cache_creation_input_tokens: 0,
          },
          ...recording.response,
        });
      },
      () => {
        reply(400, apiError('invalid_request_error', 'the body is not JSON'));
      },
    );
  });

  const url = await listen(server, options.port ?? 0);
  return { url, requests, close: () => close(server) };
}

function apiError(type: string, message: string) {
  return { type: 'error', error: { type, message } };
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
