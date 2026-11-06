

export function pendingKey(patchId) { return `eng:pending:${patchId}`; }

export async function savePendingPatch(patch, deps) {
  const { storageManager } = deps;
  try {
    const payload = JSON.stringify({
      patchId: patch.id,
      patch,
      savedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });
    await storageManager.write(pendingKey(patch.id), payload);
    console.log(`[Engineer] 💾 Pending patch saved: ${patch.id}`);
  } catch (e) {
    console.warn('[Engineer] Gagal menyimpan pending patch:', e.message);
  }
}

export async function clearPendingPatch(patchId, deps) {
  const { storageManager } = deps;
  try {
    await storageManager.write(pendingKey(patchId), null);
    console.log(`[Engineer] 🗑️ Pending patch cleared: ${patchId}`);
  } catch (e) {
    console.warn('[Engineer] Gagal menghapus pending patch:', e.message);
  }
}

export async function restorePersistedPatches(deps) {
  const { storageManager, eventBus } = deps;
  try {
    const allKeys = await storageManager.list('.');
    const pendingKeys = (allKeys || []).filter(k => String(k).includes('eng:pending:'));
    if (pendingKeys.length === 0) return;

    console.log(`[Engineer] 🔄 Menemukan ${pendingKeys.length} pending patch dari sesi sebelumnya`);
    for (const key of pendingKeys) {
      try {
        const raw = await storageManager.read(key);
        if (!raw) continue;
        const saved = JSON.parse(raw);
        if (new Date(saved.expiresAt) < new Date()) {
          await storageManager.write(key, null);
          continue;
        }
        eventBus.emit('Engineer:PatchPersisted', {
          patchId: saved.patchId,
          patch: saved.patch,
          savedAt: saved.savedAt,
          message: `📋 Ada patch yang menunggu dari sesi sebelumnya (${new Date(saved.savedAt).toLocaleString('id-ID')}). Ketik "lanjutkan patch ${saved.patchId}" untuk melanjutkan, atau "batalkan patch ${saved.patchId}" untuk membatalkan.`
        });
        console.log(`[Engineer] 📋 Restored pending patch: ${saved.patchId}`);
      } catch (e) {
        console.warn('[Engineer] Gagal restore patch:', key, e.message);
      }
    }
  } catch (e) {
    console.warn('[Engineer] _restorePersistedPatches error:', e.message);
  }
}


export function approachKey(taskType, files) {
  const raw = `${taskType}:${(files || []).sort().join(',')}`;
  let h = 5381;
  for (let i = 0; i < raw.length; i++) h = ((h << 5) + h) ^ raw.charCodeAt(i);
  return `eng:approach:${(h >>> 0).toString(16).padStart(8, '0')}`;
}

export async function saveVerifiedApproach(task, patch, deps) {
  const { storageManager } = deps;
  try {
    const taskType  = task.intent || task.type || 'MODIFY_CODE';
    const files     = patch.files?.map(f => f.path) || [];
    const key       = approachKey(taskType, files);

    let existing = null;
    try {
      const raw = await storageManager.read(key);
      if (raw) existing = JSON.parse(raw);
    } catch (_) {}

    const entry = {
      taskType,
      files,
      taskSummary: (task.description || task.title || '').slice(0, 200),
      approvalCount: (existing?.approvalCount || 0) + 1,
      lastApprovedAt: new Date().toISOString(),
      confidence: patch.confidence?.level || 'MEDIUM',
      fileChanges: files.map(f => {
        const pf = patch.files?.find(p => p.path === f);
        return { path: f, status: pf?.status || 'MODIFIED' };
      })
    };

    await storageManager.write(key, JSON.stringify(entry));
    console.log(`[Engineer] 🧠 Verified approach saved: ${taskType} (count: ${entry.approvalCount})`);

    await pruneApproachMemory('eng:approach:', 50, deps);
  } catch (e) {
    console.warn('[Engineer] _saveVerifiedApproach error (non-blocking):', e.message);
  }
}

export async function saveRejectedApproach(task, reason = '', deps) {
  const { storageManager } = deps;
  try {
    const taskType = task.intent || task.type || 'MODIFY_CODE';
    const files    = task.files || [];
    const key      = `eng:rejected:${approachKey(taskType, files).replace('eng:approach:', '')}`;

    let existing = null;
    try {
      const raw = await storageManager.read(key);
      if (raw) existing = JSON.parse(raw);
    } catch (_) {}

    const entry = {
      taskType,
      files,
      taskSummary: (task.description || task.title || '').slice(0, 200),
      rejectionCount: (existing?.rejectionCount || 0) + 1,
      lastRejectedAt: new Date().toISOString(),
      reason: reason.slice(0, 300)
    };

    await storageManager.write(key, JSON.stringify(entry));
    console.log(`[Engineer] ⚠️ Rejected pattern saved: ${taskType} (count: ${entry.rejectionCount})`);

    await pruneApproachMemory('eng:rejected:', 30, deps);
  } catch (e) {
    console.warn('[Engineer] _saveRejectedApproach error (non-blocking):', e.message);
  }
}

export async function loadVerifiedApproaches(deps) {
  const { storageManager } = deps;
  const result = { verifiedApproaches: [], rejectedPatterns: [] };
  try {
    const allKeys = await storageManager.list('.');
    if (!allKeys?.length) return result;

    const approachKeys  = allKeys.filter(k => String(k).includes('eng:approach:'));
    const rejectedKeys  = allKeys.filter(k => String(k).includes('eng:rejected:'));

    const approaches = [];
    for (const key of approachKeys) {
      try {
        const raw = await storageManager.read(key);
        if (raw) approaches.push(JSON.parse(raw));
      } catch (_) {}
    }
    result.verifiedApproaches = approaches
      .sort((a, b) => (b.approvalCount || 0) - (a.approvalCount || 0))
      .slice(0, 10);

    const rejected = [];
    for (const key of rejectedKeys) {
      try {
        const raw = await storageManager.read(key);
        if (raw) rejected.push(JSON.parse(raw));
      } catch (_) {}
    }
    result.rejectedPatterns = rejected
      .sort((a, b) => (b.rejectionCount || 0) - (a.rejectionCount || 0))
      .slice(0, 5);

    if (result.verifiedApproaches.length > 0 || result.rejectedPatterns.length > 0) {
      console.log(`[Engineer] 🧠 Loaded ${result.verifiedApproaches.length} verified approaches + ${result.rejectedPatterns.length} rejected patterns from memory`);
    }
  } catch (e) {
    console.warn('[Engineer] _loadVerifiedApproaches error (non-blocking):', e.message);
  }
  return result;
}

export async function pruneApproachMemory(prefix, maxCount, deps) {
  const { storageManager } = deps;
  try {
    const allKeys = await storageManager.list('.');
    const matching = (allKeys || []).filter(k => String(k).includes(prefix));
    if (matching.length <= maxCount) return;

    const entries = [];
    for (const key of matching) {
      try {
        const raw = await storageManager.read(key);
        if (raw) entries.push({ key, ...JSON.parse(raw) });
      } catch (_) {}
    }
    const sortedByScore = entries.sort((a, b) =>
      ((b.approvalCount || b.rejectionCount || 0)) - ((a.approvalCount || a.rejectionCount || 0))
    );
    const toDelete = sortedByScore.slice(maxCount);
    for (const e of toDelete) {
      await storageManager.write(e.key, null);
    }
  } catch (_) {}
}
