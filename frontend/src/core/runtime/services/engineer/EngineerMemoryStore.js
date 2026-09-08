/**
 * EngineerMemoryStore — Persistensi Engineer lewat StorageManager.
 * Dua sub-area: (1) Pending Patch — patch tidak hilang saat timeout/restart,
 * (2) Verified/Rejected Approach Memory — Engineer belajar dari sesi sebelumnya,
 * di-inject ke Brain 1 pada sesi berikutnya.
 *
 * Diekstrak dari engineer.js (Fase 4, ADR-0017). Semua fungsi butuh `storageManager`
 * (dan `restorePersistedPatches` butuh `eventBus` juga) lewat parameter `deps`,
 * pola sama seperti CapabilityGuard.js/StaticCodeAnalyzer.js di Fase 2 & 3.
 *
 * Catatan: `loadVerifiedApproaches` di versi lama memutasi `this.brain` langsung.
 * Di sini fungsi mengembalikan `{ verifiedApproaches, rejectedPatterns }` — caller
 * (engineer.js) yang menugaskannya ke `this.brain`, supaya modul ini tidak butuh
 * instance Engineer sama sekali.
 */

// =============================================
// PERSISTENT PENDING PATCH
// Patch tidak hilang saat timeout/restart — disimpan ke StorageManager
// =============================================

export function pendingKey(patchId) { return `eng:pending:${patchId}`; }

export async function savePendingPatch(patch, deps) {
  const { storageManager } = deps;
  try {
    const payload = JSON.stringify({
      patchId: patch.id,
      patch,
      savedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 hari
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
          await storageManager.write(key, null); // expired, hapus
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

// =============================================
// VERIFIED APPROACH MEMORY
// Engineer belajar dari setiap sesi: pendekatan yang berhasil disimpan
// dan di-inject ke Brain 1 pada sesi berikutnya.
// Storage: StorageManager lokal (eng:approach:* / eng:rejected:*)
// =============================================

export function approachKey(taskType, files) {
  // Hash sederhana dari taskType + file list untuk key unik tapi deterministik
  const raw = `${taskType}:${(files || []).sort().join(',')}`;
  let h = 5381;
  for (let i = 0; i < raw.length; i++) h = ((h << 5) + h) ^ raw.charCodeAt(i);
  return `eng:approach:${(h >>> 0).toString(16).padStart(8, '0')}`;
}

/**
 * Simpan pendekatan yang BERHASIL (patch approved) ke persistent memory.
 * Dipanggil setelah _executePatchApplication berhasil.
 */
export async function saveVerifiedApproach(task, patch, deps) {
  const { storageManager } = deps;
  try {
    const taskType  = task.intent || task.type || 'MODIFY_CODE';
    const files     = patch.files?.map(f => f.path) || [];
    const key       = approachKey(taskType, files);

    // Load existing entry jika ada (untuk increment approvalCount)
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
      // Simpan confidence terakhir sebagai sinyal kualitas
      confidence: patch.confidence?.level || 'MEDIUM',
      // Simpan garis besar approach: file mana yang diubah + status
      fileChanges: files.map(f => {
        const pf = patch.files?.find(p => p.path === f);
        return { path: f, status: pf?.status || 'MODIFIED' };
      })
    };

    await storageManager.write(key, JSON.stringify(entry));
    console.log(`[Engineer] 🧠 Verified approach saved: ${taskType} (count: ${entry.approvalCount})`);

    // Bersihkan jika terlalu banyak (max 50 entries)
    await pruneApproachMemory('eng:approach:', 50, deps);
  } catch (e) {
    console.warn('[Engineer] _saveVerifiedApproach error (non-blocking):', e.message);
  }
}

/**
 * Simpan pola yang DITOLAK user ke memory, agar Engineer hindari di masa depan.
 */
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

/**
 * Load semua verified approaches. Dipanggil di initialize() — menjadi bagian
 * Brain 1 (Static Knowledge). Caller yang menugaskan hasilnya ke this.brain.
 * @returns {Promise<{ verifiedApproaches: Array, rejectedPatterns: Array }>}
 */
export async function loadVerifiedApproaches(deps) {
  const { storageManager } = deps;
  const result = { verifiedApproaches: [], rejectedPatterns: [] };
  try {
    const allKeys = await storageManager.list('.');
    if (!allKeys?.length) return result;

    const approachKeys  = allKeys.filter(k => String(k).includes('eng:approach:'));
    const rejectedKeys  = allKeys.filter(k => String(k).includes('eng:rejected:'));

    // Load approaches
    const approaches = [];
    for (const key of approachKeys) {
      try {
        const raw = await storageManager.read(key);
        if (raw) approaches.push(JSON.parse(raw));
      } catch (_) {}
    }
    // Sort by approvalCount desc — yang paling sering berhasil tampil duluan
    result.verifiedApproaches = approaches
      .sort((a, b) => (b.approvalCount || 0) - (a.approvalCount || 0))
      .slice(0, 10); // max 10 untuk dijadikan konteks LLM

    // Load rejected patterns
    const rejected = [];
    for (const key of rejectedKeys) {
      try {
        const raw = await storageManager.read(key);
        if (raw) rejected.push(JSON.parse(raw));
      } catch (_) {}
    }
    result.rejectedPatterns = rejected
      .sort((a, b) => (b.rejectionCount || 0) - (a.rejectionCount || 0))
      .slice(0, 5); // max 5 pola yang paling sering ditolak

    if (result.verifiedApproaches.length > 0 || result.rejectedPatterns.length > 0) {
      console.log(`[Engineer] 🧠 Loaded ${result.verifiedApproaches.length} verified approaches + ${result.rejectedPatterns.length} rejected patterns from memory`);
    }
  } catch (e) {
    console.warn('[Engineer] _loadVerifiedApproaches error (non-blocking):', e.message);
  }
  return result;
}

/**
 * Hapus entries lama jika jumlah melebihi batas.
 * Strategi: hapus yang paling jarang diapprove / paling lama.
 */
export async function pruneApproachMemory(prefix, maxCount, deps) {
  const { storageManager } = deps;
  try {
    const allKeys = await storageManager.list('.');
    const matching = (allKeys || []).filter(k => String(k).includes(prefix));
    if (matching.length <= maxCount) return;

    // Load semua, sort, hapus yang paling tidak berguna
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
