export function safeJsonParse<T>(jsonString: string | null | undefined, fallback: T): T {
  if (!jsonString || typeof jsonString !== 'string') {
    return fallback;
  }
  const trimmed = jsonString.trim();
  if (!trimmed || trimmed.startsWith('<')) {
    return fallback;
  }
  try {
    return JSON.parse(trimmed) as T;
  } catch (err) {
    return fallback;
  }
}
