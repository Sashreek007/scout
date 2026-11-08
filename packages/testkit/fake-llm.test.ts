import { describe, expect, it } from 'vitest';
import { aJob, aProfile } from './builders';
import { FakeLlm } from './fake-llm';

describe('FakeLlm', () => {
  it('replays the recorded triage for a job and records the call', async () => {
    const llm = FakeLlm.recorded();
    const { outcomes, costUsd } = await llm.triage([aJob()], aProfile());
    expect(outcomes[0]?.result).toMatchObject({
      ok: true,
      triage: { decision: 'apply', score: 82, lead: 'backend' },
    });
    expect(costUsd).toBe(0);
    expect(llm.calls).toEqual([{ method: 'triage', jobKey: 'greenhouse:northwind:4100001' }]);
  });

  it('replays a recorded refusal', async () => {
    const llm = new FakeLlm({ triage: { [aJob().key]: { refused: 'declined: cyber' } } });
    const { outcomes } = await llm.triage([aJob()], aProfile());
    expect(outcomes[0]?.result).toEqual({
      ok: false,
      reason: 'refusal',
      message: 'declined: cyber',
    });
  });

  it('fails loudly for a job with no recording', async () => {
    const llm = new FakeLlm();
    await expect(llm.triage([aJob({ key: 'lever:eqbank:x' })], aProfile())).rejects.toThrow(
      'FakeLlm has no recorded triage for lever:eqbank:x',
    );
  });

  it('replays a recorded plan', async () => {
    const llm = FakeLlm.recorded();
    const plan = await llm.plan({
      job: aJob(),
      form: { board: 'greenhouse', url: 'https://example.com', readAt: new Date(), fields: [] },
      profile: aProfile(),
      memory: [],
      answered: [],
    });
    expect(plan.fields.map((field) => field.kind)).toEqual(['draft', 'unknown']);
  });

  it('rejects a recording that breaks the triage schema', async () => {
    const llm = new FakeLlm({
      triage: { [aJob().key]: { decision: 'yes', score: 2, reasons: [], lead: 'ai', flags: [] } },
    } as never);
    await expect(llm.triage([aJob()], aProfile())).rejects.toThrow();
  });
});
