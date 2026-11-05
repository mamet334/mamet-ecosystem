// UKUR OCR HALAMAN CENTANG — bahan uji "centang ditulis sebagai kata saat unggah" (K1, 5 Nov 2026), versi oc-2.
//
// Kenapa: aturan baru memasangkan tanda centang ke-k di PDF (posisi pdf.js, kolom pasti) dengan tanda ke-k di
// TEKS OCR halaman itu. Anggapan "urutannya sama" hanya bisa diuji dengan teks OCR sungguhan per halaman — potongan
// di database tumpang-tindih dan urutannya hilang. Modul ini meng-OCR HANYA halaman yang akan di-OCR aplikasi
// (halaman bertabel) DAN bertanda centang, dari 222 berkas di `uji/data-lokal/kepbup-per-jabatan/`, lalu
// mengunduh hasilnya sebagai `ocr-centang-kepbup.json`. Berkas itu disalin ke `uji/data-lokal/`, dan sejak itu
// aturan baru diuji di Node berulang kali tanpa biaya.
//
// Pemakaian — konsol DevTools `npm run desktop` (mode dev), sudah login, kunci OpenRouter di Settings:
//   await (await import(`/@fs/D:/SLAMET/other/mamet os ecosystem/uji/ukur-ocr-centang.js?t=${Date.now()}`)).ukur()
//     → hanya MENGHITUNG halaman & perkiraan biaya (tanpa OCR, $0)
//   await (await import(`/@fs/D:/SLAMET/other/mamet os ecosystem/uji/ukur-ocr-centang.js?t=${Date.now()}`)).ukur({ setuju: true })
//     → OCR sungguhan (mistral-ocr lewat OpenRouter, $0,002/halaman), lalu berkas hasil diunduh
// Opsi: .ukur({ hanya: ['177'] }) → berkas yang namanya memuat teks itu saja.
//
// Kunci dibaca dari VaultService sama seperti Research App dan langsung diteruskan ke OCR; tidak dicetak, tidak
// ikut ke berkas hasil. Tidak ada yang diunggah ke RAG dan tidak ada yang ditulis ke database.

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

  // 1. Baca semua berkas dengan pdf.js (gratis): halaman bertabel ∩ halaman bertanda centang.
  const rencana = [];
  for (const [i, nama] of daftar.entries()) {
    // encodeURI, bukan encodeURIComponent: Vite tidak menerjemahkan balik %2C/%26 lalu mengirim index.html — 17 berkas
    // bernama "," atau "&" dulu terbaca "PDF rusak" (oc-1). Bukan PDF → berhenti, jangan diam-diam dilewati.
    const bytes = new Uint8Array(await (await fetch(`${DIR}/kepbup-per-jabatan/${encodeURI(nama)}`)).arrayBuffer());
    if (String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') throw new Error(`${nama}: yang terambil bukan PDF (jalur salah?)`);
    let hasil;
    try {
      hasil = await ekstrakTeksDokumen(new File([bytes], nama, { type: 'application/pdf' }));
    } catch (e) {
      // 000 - Pembuka Keputusan = hasil pindaian (changelog 17 Sep) — memang ditolak ekstraktor.
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

  // 2. OCR — kunci langsung ke layanan OCR, tidak disimpan di variabel hasil.
  let kunci = null;
  try { kunci = sm.get('VaultService')?.getKey('openrouter') || null; } catch { /* vault belum siap */ }
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
