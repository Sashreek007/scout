import { FirestoreStore, clearEmulator, emulatorFirestore } from '@scout/adapters';
import { aProfile, startFakeClaude, startFakeJobBoard, type ClaudeRecording } from '@scout/testkit';
import { afterEach, describe, expect, it } from 'vitest';
import { runPipeline } from './pipeline';
import { productionDeps } from './production';

const API_KEY = `sk-ant-api03-${'f'.repeat(40)}`;
const maybe: ClaudeRecording = {
  match: { contains: ['Triage this posting.'] },
  response: {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          decision: 'maybe',
          score: 50,
          reasons: ['Fixture'],
          lead: 'backend',
          flags: [],
        }),
      },
    ],
  },
};

describe('the daily run as main.ts wires it', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('runs end to end on the emulator, with every request sent to the fakes', async () => {
    await clearEmulator();
    const store = new FirestoreStore(emulatorFirestore());
    await store.profile.put(aProfile());
    const board = await startFakeJobBoard();
    const claude = await startFakeClaude({ recordings: [maybe] });
    try {
      // The Anthropic SDK reads these itself, so the key never passes through scout's code.
      process.env.ANTHROPIC_API_KEY = API_KEY;
      process.env.ANTHROPIC_BASE_URL = claude.url;
      const { deps, target } = await productionDeps({
        ...process.env,
        SCOUT_BOARD_BASE_URL: board.url,
        SCOUT_COMMIT: '3c22f9b',
        SCOUT_DASHBOARD_URL: 'https://scout.example.app',
      });
      expect(target).toMatch(/^the emulator at /);
      expect(deps).toMatchObject({ commit: '3c22f9b', dashboardUrl: 'https://scout.example.app' });
      expect(deps.secrets).toContain(API_KEY);

      const run = await runPipeline(deps);
      expect(run.status).toBe('partial');
      expect(run.jobs.new).toBe(647);
      expect(run.triageDecisions).toEqual({ maybe: 60 });
      expect(claude.batches).toHaveLength(1);
      expect(run.digest).toMatchObject({ title: '60 new matches', notified: true });
      // Every request went to the fakes: the lists, the boards and the short links.
      expect(board.requestUrls.every((url) => !url.startsWith('http'))).toBe(true);
      expect(board.requestUrls.some((url) => url.startsWith('/go.vansh.nyc/'))).toBe(true);
      expect(JSON.stringify(await store.runs.list())).not.toContain(API_KEY);
    } finally {
      await claude.close();
      await board.close();
    }
  }, 60_000);
});
