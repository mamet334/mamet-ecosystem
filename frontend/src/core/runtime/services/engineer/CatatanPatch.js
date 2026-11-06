
const KUNCI = 'mamet:patchBerjalan';
const BATAS_ISI = 200 * 1024;
const USIA_MAKS_MS = 15 * 60 * 1000;

const penyimpanan = (ls) => ls || (typeof localStorage !== 'undefined' ? localStorage : null);

export function simpanCatatanPatch({ patchId, checkpointRef, files }, ls) {
  const s = penyimpanan(ls);
  if (!s) return;
  try {
    s.setItem(KUNCI, JSON.stringify({
      patchId, checkpointRef, waktu: Date.now(),
      files: (files || []).map((f) => ({ path: f.path, isi: f.newContent && f.newContent.length <= BATAS_ISI ? f.newContent : null })),
    }));
  } catch {  }
}

export function hapusCatatanPatch(ls) {
  try { penyimpanan(ls)?.removeItem(KUNCI); } catch {  }
}

export async function laporanSetelahMuatUlang(bacaBerkas, ls, sekarang = Date.now(), hapusSekarang = true) {
  const s = penyimpanan(ls);
  if (!s) return null;
  let catatan = null;
  try { catatan = JSON.parse(s.getItem(KUNCI) || 'null'); } catch { catatan = null; }
  const basi = !catatan || !Array.isArray(catatan.files) || sekarang - (catatan.waktu || 0) > USIA_MAKS_MS;
  if (hapusSekarang || basi) hapusCatatanPatch(s);
  if (basi) return null;

  const baris = [];
  let semuaTerapan = true;
  for (const f of catatan.files) {
    let isiDisk = null;
    try { isiDisk = await bacaBerkas(f.path); } catch { isiDisk = null; }
    const sama = (a, b) => typeof a === 'string' && typeof b === 'string' && a.replace(/\r\n/g, '\n') === b.replace(/\r\n/g, '\n');
    if (f.isi === null) { baris.push(`❔ \`${f.path}\` — terlalu besar untuk dipastikan; periksa dengan git diff`); semuaTerapan = false; }
    else if (sama(isiDisk, f.isi)) baris.push(`✅ \`${f.path}\` — isi di disk sesuai patch`);
    else { baris.push(`⚠️ \`${f.path}\` — isi di disk TIDAK sesuai patch (penulisan mungkin terputus)`); semuaTerapan = false; }
  }
  const judul = semuaTerapan ? '✅ **Patch diterapkan**' : '⚠️ **Patch belum pasti diterapkan**';
  return {
    checkpointRef: catatan.checkpointRef || null,
    patchId: catatan.patchId,
    pesan: `${judul} _(aplikasi dimuat ulang otomatis karena berkas aplikasi berubah — hasil dibaca ulang dari disk)_\n\n${baris.join('\n')}${catatan.checkpointRef ? '\n\n💾 Checkpoint tersedia — tombol Undo mengembalikan berkas di atas.' : ''}`,
  };
}
