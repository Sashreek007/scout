import { describe, expect, it } from 'vitest';
import { ModelsConfigSchema } from './models-config';

describe('ModelsConfigSchema', () => {
  it('reads an empty document as the defaults from section 5c', () => {
    const config = ModelsConfigSchema.parse({});
    expect(config.triage).toEqual({
      account: 'api',
      model: 'claude-haiku-5-5',
      effort: 'low',
      refusalModel: 'claude-sonnet-5-5',
      batch: true,
    });
    expect(config.planning).toMatchObject({ model: 'claude-sonnet-5-5', effort: 'medium' });
    expect(config.tailoring).toMatchObject({ model: 'claude-sonnet-5-5', effort: 'high' });
  });

  it('keeps what Settings changed and fills in the rest', () => {
    const config = ModelsConfigSchema.parse({ triage: { model: 'claude-sonnet-5-5' } });
    expect(config.triage).toMatchObject({ model: 'claude-sonnet-5-5', effort: 'low', batch: true });
  });

  it('rejects an effort that does not exist and a task it does not know', () => {
    expect(ModelsConfigSchema.safeParse({ triage: { effort: 'extreme' } }).success).toBe(false);
    expect(ModelsConfigSchema.safeParse({ dreaming: {} }).success).toBe(false);
  });
});
