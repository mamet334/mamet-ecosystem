
const BATAS_USULAN_HURUF = 8000;

export function berkasDariUsulan(teks) {
  const hasil = [];
  for (const m of String(teks || '').matchAll(/```(?:json)?[ \t]*\n([\s\S]*?)\n?```/gi)) {
    let obj;
    try { obj = JSON.parse(m[1]); } catch { continue; }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) continue;
    for (const kunci of Object.keys(obj)) {
      const alamat = kunci.trim().replace(/\\/g, '/');
      if (/^[\w.-]+(\/[\w .-]+)+\.[a-z0-9]+$/i.test(alamat) && !alamat.split('/').includes('..') && !hasil.includes(alamat)) {
        hasil.push(alamat);
      }
    }
  }
  return hasil;
}

export function tugasDariUsulan({ pesanAsli, jawaban }) {
  const files = berkasDariUsulan(jawaban);
  const usulan = String(jawaban || '');
  const potong = usulan.length > BATAS_USULAN_HURUF ? `${usulan.slice(0, BATAS_USULAN_HURUF)}\n… (usulan dipotong)` : usulan;
  return {
    id: `TASK-${Date.now()}`,
    title: String(pesanAsli || '').substring(0, 100),
    description: `${pesanAsli || ''}\n\nUSULAN ENGINEER YANG DISETUJUI OWNER — pakai sebagai panduan MAKSUD perubahan, bukan isi berkas. Baca berkas asli, ubah HANYA bagian yang dimaksud dengan cari-ganti, semua baris lain tetap sama persis:\n${potong}`,
    files,
    dariTombolApply: true,
    llmProposedContent: jawaban,
  };
}
