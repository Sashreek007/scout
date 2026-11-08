import { describe, expect, it } from 'vitest';
import { validRun } from './examples.fixture';
import { RunSchema } from './run';

describe('RunSchema', () => {
  it('parses a finished run with a caught error', () => {
    const run = RunSchema.parse(validRun);
    expect(run.status).toBe('partial');
    expect(run.errors[0]?.target).toBe('vansh');
  });

  it('parses a run that is still going', () => {
    expect(RunSchema.safeParse({ ...validRun, status: 'running', finishedAt: null }).success).toBe(
      true,
    );
  });

  it('rejects a finished run with no finishedAt', () => {
    expect(RunSchema.safeParse({ ...validRun, finishedAt: null }).success).toBe(false);
  });

  it('rejects a filter reason that does not exist', () => {
    expect(RunSchema.safeParse({ ...validRun, filterReasons: { weather: 1 } }).success).toBe(false);
  });

  it('loads a run stored before job counts existed, with zeros', () => {
    expect('jobs' in validRun).toBe(false);
    expect(RunSchema.parse(validRun).jobs).toEqual({
      new: 0,
      changed: 0,
      unchanged: 0,
      outsideCanada: 0,
      missed: 0,
      inactive: 0,
      applicationsClosed: 0,
    });
  });
});
