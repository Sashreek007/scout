// Keeping secrets out of the run log (#11). An error message can quote a request, a header or a
// config value, and `runs/` is readable from the dashboard, so every message is cleaned first.

export const REDACTED = '[redacted]';

/** The environment variables that hold secrets. */
export const SECRET_VARIABLES = ['ANTHROPIC_API_KEY', 'FIREBASE_SERVICE_ACCOUNT'] as const;

/** Shapes a secret has even when scout doesn't know its value, with what replaces each. */
const RULES: [RegExp, string][] = [
  // Anthropic API keys and admin keys.
  [/sk-ant-[\w-]{8,}/g, REDACTED],
  // A PEM private key, like the one in a service account, with real or escaped newlines.
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, REDACTED],
  // `Authorization: Bearer ...` and `x-api-key: ...` in a dumped request.
  [
    /\b(authorization|x-api-key|x-goog-api-key)(["']?\s*[:=]\s*["']?)(?:bearer\s+)?[^\s"',}]+/gi,
    `$1$2${REDACTED}`,
  ],
  // A query string carrying a key or a token.
  [/([?&](?:key|token|access_token|api_key|sig|signature)=)[^&\s"']+/gi, `$1${REDACTED}`],
];

/**
 * The values to hide from every message: each secret variable's value and, for the service account
 * JSON, its private key, key ID and client email too, in both their plain and JSON-escaped forms.
 * Values under 8 characters are ignored, so a placeholder can't blank out ordinary words.
 */
export function secretValues(
  env: Readonly<Record<string, string | undefined>>,
  names: readonly string[] = SECRET_VARIABLES,
): string[] {
  const values: string[] = [];
  for (const name of names) {
    const value = env[name]?.trim();
    if (!value) continue;
    values.push(value);
    if (!value.startsWith('{')) continue;
    try {
      const json = JSON.parse(value) as Record<string, unknown>;
      for (const field of ['private_key', 'private_key_id', 'client_email', 'client_id']) {
        const inner = json[field];
        if (typeof inner === 'string') values.push(inner, JSON.stringify(inner).slice(1, -1));
      }
    } catch {
      // Not JSON after all; the whole value is still hidden.
    }
  }
  // Longest first, so a value that contains a shorter one is replaced whole.
  return [...new Set(values.filter((value) => value.length >= 8))].sort(
    (a, b) => b.length - a.length,
  );
}

/** A message with every known secret value, and every secret-shaped string, replaced. */
export function redact(message: string, secrets: readonly string[] = []): string {
  let clean = message;
  for (const secret of secrets) clean = clean.split(secret).join(REDACTED);
  for (const [pattern, replacement] of RULES) clean = clean.replace(pattern, replacement);
  return clean;
}
