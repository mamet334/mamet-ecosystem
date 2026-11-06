
export function dibatalkanPemakai(err, signal) {
  if (signal?.aborted) return true;
  const n = err?.name;
  return n === 'AbortError' || n === 'TimeoutError';
}
