import { describe, expect, it } from 'vitest';
import { REDACTED, redact, secretValues } from './redact';

// Made-up values shaped like the real ones. None of these is a real secret.
const API_KEY = `sk-ant-api03-${'x'.repeat(40)}`;
const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----\n${'A'.repeat(64)}\n-----END PRIVATE KEY-----\n`;
const SERVICE_ACCOUNT = JSON.stringify({
  type: 'service_account',
  project_id: 'scout-prod',
  private_key_id: 'abcdef0123456789abcdef',
  private_key: PRIVATE_KEY,
  client_email: 'pipeline@scout-prod.iam.gserviceaccount.com',
});
const env = { ANTHROPIC_API_KEY: API_KEY, FIREBASE_SERVICE_ACCOUNT: SERVICE_ACCOUNT };

describe('redact', () => {
  it('hides the API key and every part of the service account from an error', () => {
    const secrets = secretValues(env);
    const error = [
      `401 from api.anthropic.com with x-api-key ${API_KEY}`,
      `could not parse FIREBASE_SERVICE_ACCOUNT=${SERVICE_ACCOUNT}`,
      `signing as pipeline@scout-prod.iam.gserviceaccount.com with ${JSON.stringify(PRIVATE_KEY)}`,
    ].join('\n');
    const clean = redact(error, secrets);
    for (const secret of [
      API_KEY,
      'pipeline@scout-prod.iam.gserviceaccount.com',
      'abcdef0123456789abcdef',
      'A'.repeat(64),
    ]) {
      expect(clean).not.toContain(secret);
    }
    expect(clean).toContain(REDACTED);
    expect(clean).toContain('401 from api.anthropic.com');
  });

  it('hides secret-shaped strings it was never told about', () => {
    const clean = redact(
      [
        'Authorization: Bearer ya29.a0AfH6SMBexample',
        '"x-api-key": "sk-ant-admin01-yyyyyyyyyyyyyyyyyyyy"',
        'GET https://fcm.googleapis.com/v1/send?key=AIzaSyExampleExample&x=1',
        PRIVATE_KEY,
      ].join('\n'),
    );
    expect(clean).not.toMatch(/ya29|sk-ant-|AIzaSy|AAAA/);
    expect(clean).toContain('Authorization: [redacted]');
    expect(clean).toContain('?key=[redacted]&x=1');
  });

  it('leaves an ordinary message as it was', () => {
    const message = 'vansh: https://raw.githubusercontent.com/x timed out after 30000 ms';
    expect(redact(message, secretValues(env))).toBe(message);
  });

  it('ignores unset or tiny variables, so they cannot blank out words', () => {
    expect(secretValues({ ANTHROPIC_API_KEY: '', FIREBASE_SERVICE_ACCOUNT: 'x' })).toEqual([]);
  });
});
