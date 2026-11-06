import {
  AgentConfigSchema,
  ApplicationSchema,
  JobSchema,
  ProfileSchema,
  QuestionSchema,
  StageEventSchema,
} from '@scout/core';
import { describe, expect, it } from 'vitest';
import { devSeed } from './seed';

describe('devSeed', () => {
  const seed = devSeed();

  it('holds only valid documents', () => {
    expect(() => ProfileSchema.parse(seed.profile)).not.toThrow();
    expect(() => AgentConfigSchema.parse(seed.agentConfig)).not.toThrow();
    for (const job of seed.jobs) expect(() => JobSchema.parse(job)).not.toThrow();
    for (const q of seed.questions) expect(() => QuestionSchema.parse(q)).not.toThrow();
    for (const { app, events } of seed.applications) {
      expect(() => ApplicationSchema.parse(app)).not.toThrow();
      for (const event of events) expect(() => StageEventSchema.parse(event)).not.toThrow();
    }
  });

  it('gives every application a job and an unbroken history ending in its stage', () => {
    const jobKeys = new Set(seed.jobs.map((job) => job.key));
    for (const { app, events } of seed.applications) {
      expect(jobKeys.has(app.jobKey)).toBe(true);
      expect(events[0]?.from).toBeNull();
      for (let i = 1; i < events.length; i++) expect(events[i]?.from).toBe(events[i - 1]?.to);
      expect(events.at(-1)?.to).toBe(app.stage);
    }
  });

  it('only asks questions for applications that exist', () => {
    const appKeys = new Set(seed.applications.map(({ app }) => app.jobKey));
    for (const question of seed.questions) expect(appKeys.has(question.jobKey)).toBe(true);
  });
});
