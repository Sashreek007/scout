// The lint rule that keeps packages/core free of network code (#1) is itself tested, so a config
// change can't quietly switch it off.
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';

// The snippets aren't files on disk, so they are linted without type information.
const eslint = new ESLint({
  cwd: import.meta.dirname,
  overrideConfig: tseslint.configs.disableTypeChecked,
});

async function lintAs(filePath: string, code: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).map((message) => message.ruleId);
}

describe('packages/core import ban', () => {
  it.each([
    "import { initializeApp } from 'firebase/app';",
    "import { getFirestore } from 'firebase-admin/firestore';",
    "import admin from 'firebase-admin';",
    "import { chromium } from 'playwright';",
    "import Anthropic from '@anthropic-ai/sdk';",
    "import type { Message } from '@anthropic-ai/sdk/resources';",
    "import { request } from 'node:https';",
  ])('fails %s', async (code) => {
    const rules = await lintAs('packages/core/bad.ts', `${code}\nexport {};\n`);
    expect(rules).toContain('@typescript-eslint/no-restricted-imports');
  });

  it('fails a call to fetch', async () => {
    const rules = await lintAs('packages/core/bad.ts', "export const go = () => fetch('x');\n");
    expect(rules).toContain('no-restricted-globals');
  });

  it('allows the same imports outside core', async () => {
    const rules = await lintAs(
      'packages/adapters/fine.ts',
      "import admin from 'firebase-admin';\nexport const app = admin;\n",
    );
    expect(rules).not.toContain('@typescript-eslint/no-restricted-imports');
  });
});
