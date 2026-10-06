const SECRET = /password|token|secret|authorization/i;

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      output[key] = SECRET.test(key) ? '[redacted]' : redact(nested);
    }
    return output;
  }
  return value;
}
