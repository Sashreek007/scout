import { describe, expect, it } from 'vitest';
import { connectFirestore } from './connect';

describe('connectFirestore', () => {
  it('asks for a project and key instead of guessing credentials', () => {
    expect(() => connectFirestore({})).toThrow(
      'Set FIREBASE_PROJECT_ID and FIREBASE_SERVICE_ACCOUNT',
    );
    expect(() => connectFirestore({ FIREBASE_PROJECT_ID: 'scout-dev' })).toThrow(
      'Set FIREBASE_PROJECT_ID and FIREBASE_SERVICE_ACCOUNT',
    );
  });

  it('never echoes a malformed key', () => {
    const key = 'not json but secret-looking-value';
    try {
      connectFirestore({ FIREBASE_PROJECT_ID: 'scout-dev', FIREBASE_SERVICE_ACCOUNT: key });
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).toBe(
        'FIREBASE_SERVICE_ACCOUNT is not valid JSON. It should hold the key file.',
      );
      expect((error as Error).message).not.toContain(key);
    }
  });
});
