export function jejakUntukMonitor(steps, jsonMetadata) {
  const langkah = Array.isArray(steps) && steps.length > 0 ? steps : (jsonMetadata?.processingSteps || []);
  if (!jsonMetadata && langkah.length === 0) return null;
  return { focusStep: 'execution', logs: { ...(jsonMetadata || {}), processingSteps: langkah } };
}
