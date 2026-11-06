import { extractFileNamesFromTask } from './FileSystemGateway.js';

export async function buildDynamicContext(task, deps) {
  const { fileIndexService, brain, sessionArtifact } = deps;
  const targetFiles = task.files || extractFileNamesFromTask(task);
  let availableFiles = [];

  try {
    if (fileIndexService && fileIndexService.isReady) {
      availableFiles = fileIndexService.getAllFiles?.() || [];
    }
  } catch (e) {
    console.warn('[Engineer] Gagal mengambil file list dari FileIndexService:', e.message);
  }

  return {
    task: {
      id: task.id,
      title: task.title,
      description: task.description,
      files: targetFiles,
      requestedModel: task.requestedModel || null
    },
    projectContext: {
      totalIndexedFiles: availableFiles.length,
      targetFileCount: targetFiles.length,
      staticKnowledgeLoaded: brain.static?.loadedFiles?.length || 0
    },
    sessionContext: sessionArtifact ? sessionArtifact.getSummary() : null,
    timestamp: new Date().toISOString()
  };
}

