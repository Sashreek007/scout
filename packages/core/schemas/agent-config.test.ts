import { describe, expect, it } from 'vitest';
import { AgentConfigSchema } from './agent-config';

describe('AgentConfigSchema', () => {
  it('turns an empty document into the defaults from section 6', () => {
    expect(AgentConfigSchema.parse({})).toEqual({
      paused: false,
      dailyCap: 20,
      workers: 3,
      perCompany: 1,
      perBoard: 2,
      paceSeconds: { min: 120, max: 300 },
      liveQuestionMinutes: 10,
      stepTimeouts: { open: 60, fill: 300, readBack: 60, askLive: 600, submit: 60, confirm: 60 },
      stepRetries: { open: 2, fill: 1, readBack: 1, askLive: 0, submit: 0, confirm: 0 },
      finalClick: {
        greenhouse: 'hold',
        lever: 'hold',
        ashby: 'hold',
        workday: 'hold',
        other: 'hold',
      },
      autoQueueScore: 80,
      maxTriagePerRun: 60,
      genericFiller: false,
    });
  });

  it('keeps his settings, including no daily cap', () => {
    const config = AgentConfigSchema.parse({
      dailyCap: null,
      workers: 8,
      finalClick: { greenhouse: 'auto' },
    });
    expect(config.dailyCap).toBeNull();
    expect(config.finalClick).toMatchObject({ greenhouse: 'auto', lever: 'hold' });
  });

  it('rejects 9 workers and a pace whose min is above its max', () => {
    expect(AgentConfigSchema.safeParse({ workers: 9 }).success).toBe(false);
    expect(AgentConfigSchema.safeParse({ paceSeconds: { min: 400, max: 300 } }).success).toBe(
      false,
    );
  });

  it('never allows retrying submit', () => {
    expect(AgentConfigSchema.safeParse({ stepRetries: { submit: 1 } }).success).toBe(false);
  });
});
