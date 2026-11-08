import Anthropic from '@anthropic-ai/sdk';

/**
 * The Anthropic client. With no options it reads `ANTHROPIC_API_KEY` from the environment, which
 * is where the key lives: GitHub Actions secrets and the Mac's `.env`, never the code. Tests point
 * `baseURL` at the fake Claude and pass a dummy key.
 */
export function createClaudeClient(
  options: { baseURL?: string; apiKey?: string; maxRetries?: number } = {},
): Anthropic {
  return new Anthropic(options);
}
