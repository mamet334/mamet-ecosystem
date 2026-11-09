
const VERSI = 'oc-2';
const DIR = new URL('./data-lokal', import.meta.url).href;

export async function ukur({ setuju = false, hanya = null } = {}) {
  console.log(`[ukur-ocr-centang] versi ${VERSI}`);
  const sm = window.__mamet?.serviceManager;
  if (!sm) throw new Error('window.__mamet tidak ada — jalankan dari `npm run desktop` (mode dev).');
  const { ekstrakTeksDokumen } = await import('/src/core/runtime/services/documentTextExtractor.js');
  const { terapkanOcrHalaman, perkiraanOcr } = await import('/src/core/runtime/services/pdfOcrService.js');
  const daftar = (await (await fetch(`${DIR}/daftar-kepbup-per-jabatan.json`)).json())
    .filter((n) => !hanya || hanya.some((h) => n.includes(h)));

  const rencana = [];
  for (const [i, nama] of daftar.entries()) {
    const bytes = new Uint8Array(await (await fetch(`${DIR}/kepbup-per-jabatan/${encodeURI(nama)}`)).arrayBuffer());
    if (String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') throw new Error(`${nama}: yang terambil bukan PDF (jalur salah?)`);
    let hasil;
    try {
      hasil = await ekstrakTeksDokumen(new File([bytes], nama, { type: 'application/pdf' }));
    } catch (e) {
      console.warn(`[ukur-ocr-centang] ${nama}: ${e?.kode || e?.name || 'galat'} — dilewati`);
      continue;
    }
    const bertabel = new Set(hasil.halamanBertabelTerdeteksi || []);
    const halaman = (hasil.halamanTabelCentang || []).filter((n) => bertabel.has(n));
    rencana.push({ nama, bytes, halaman, centangTanpaOcr: (hasil.halamanTabelCentang || []).filter((n) => !bertabel.has(n)) });
    if ((i + 1) % 25 === 0) console.log(`[ukur-ocr-centang] dibaca ${i + 1}/${daftar.length}`);
  }
  const total = rencana.reduce((s, r) => s + r.halaman.length, 0);
  const tanpaOcr = rencana.reduce((s, r) => s + r.centangTanpaOcr.length, 0);
  console.log(`[ukur-ocr-centang] ${daftar.length} berkas · ${total} halaman centang akan di-OCR (≈ $${perkiraanOcr(total).toFixed(2)}) · ${tanpaOcr} halaman centang tetap teks pdf.js`);
  if (!setuju) {
    console.log('[ukur-ocr-centang] belum OCR. Jalankan lagi dengan .ukur({ setuju: true }).');
    return { berkas: daftar.length, halamanOcr: total, halamanTanpaOcr: tanpaOcr };
  }

  let kunci = null;
  try { kunci = sm.get('VaultService')?.getKey('openrouter') || null; } catch {  }
  if (!kunci) throw new Error('Kunci OpenRouter belum ada di Settings.');
  const keluaran = { versi: VERSI, waktu: new Date().toISOString(), berkas: [] };
  let selesai = 0;
  let gagal = 0;
  for (const r of rencana) {
    if (!r.halaman.length) { keluaran.berkas.push({ nama: r.nama, ocr: {}, gagal: [], centangTanpaOcr: r.centangTanpaOcr }); continue; }
    const { peta, halamanGagal } = await terapkanOcrHalaman(r.bytes, r.halaman, kunci);
    selesai += r.halaman.length - halamanGagal.length;
    gagal += halamanGagal.length;
    keluaran.berkas.push({ nama: r.nama, ocr: Object.fromEntries([...peta]), gagal: halamanGagal, centangTanpaOcr: r.centangTanpaOcr });
    console.log(`[ukur-ocr-centang] ${r.nama.slice(0, 40)} · ${r.halaman.length} hal${halamanGagal.length ? ` · ${halamanGagal.length} gagal` : ''} · total ${selesai}/${total}`);
  }
  kunci = null;
  console.log(`[ukur-ocr-centang] selesai: ${selesai} halaman OCR, ${gagal} gagal`);
  const blob = new Blob([JSON.stringify(keluaran)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = hanya ? 'ocr-centang-kepbup-tambahan.json' : 'ocr-centang-kepbup.json';
  a.click();
  return { halamanOcr: selesai, gagal };
}
