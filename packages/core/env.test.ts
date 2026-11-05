import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ENV_VARIABLES, EnvSchema } from './env';

const example = readFileSync(new URL('../../.env.example', import.meta.url), 'utf8');
const assignments = example
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line !== '' && !line.startsWith('#'))
  .map((line) => {
    const [name = '', ...rest] = line.split('=');
    return { name, value: rest.join('=') };
  });

describe('.env.example', () => {
  it('lists exactly the variables the apps read', () => {
    expect(assignments.map((a) => a.name).sort()).toEqual([...ENV_VARIABLES].sort());
  });

  it('holds no values', () => {
    expect(assignments.filter((a) => a.value !== '')).toEqual([]);
  });
});

describe('EnvSchema', () => {
  it('accepts an empty environment and rejects a malformed URL', () => {
    expect(EnvSchema.safeParse({}).success).toBe(true);
    expect(EnvSchema.safeParse({ ANTHROPIC_BASE_URL: 'localhost' }).success).toBe(false);
  });
});
