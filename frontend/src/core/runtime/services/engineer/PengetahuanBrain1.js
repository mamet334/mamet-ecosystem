
export const JENIS = ['ADRLink', 'Solution', 'Lesson', 'RootCause'];

export const JENIS_BAWAAN = 'Lesson';

const POLA_BLOK = /<pengetahuan\b([^>]*)>([\s\S]*?)<\/pengetahuan>/g;
const POLA_ATRIBUT = /([a-z]+)\s*=\s*"([^"]*)"/g;

const rapikan = (s) => String(s ?? '').replace(/\r\n/g, '\n').trim();

function normalkanJenis(nilai) {
  const n = rapikan(nilai).toLowerCase();
  return JENIS.find((j) => j.toLowerCase() === n) || JENIS_BAWAAN;
}

export function ambilBlokPengetahuan(teks) {
  const isi = rapikan(teks);
  const pengetahuan = [];
  const dilewati = [];
  if (!isi) return { pengetahuan, dilewati };

  for (const m of isi.matchAll(POLA_BLOK)) {
    const atribut = {};
    for (const a of String(m[1] || '').matchAll(POLA_ATRIBUT)) atribut[a[1]] = a[2];

    const judul = rapikan(atribut.judul);
    const konten = rapikan(m[2]);

    if (!judul) { dilewati.push({ alasan: 'tanpa atribut judul', potongan: konten.slice(0, 80) }); continue; }
    if (!konten) { dilewati.push({ alasan: 'isinya kosong', potongan: judul.slice(0, 80) }); continue; }

    pengetahuan.push({ jenis: normalkanJenis(atribut.jenis), judul, isi: konten });
  }
  return { pengetahuan, dilewati };
}

const kunci = (j) => rapikan(j).toLowerCase().replace(/\s+/g, ' ');

export function pengetahuanBaru(judulTersimpan, calon) {
  const ada = new Set((judulTersimpan || []).map(kunci));
  const hasil = [];
  for (const p of calon || []) {
    const k = kunci(p.judul);
    if (ada.has(k)) continue;
    ada.add(k);
    hasil.push(p);
  }
  return hasil;
}

export function barisBrain1(p, userId) {
  return {
    entry_type: p.jenis,
    title: p.judul,
    content: p.isi,
    user_id: userId,
    status: 'Hypothesis',
    governance_status: 'ACTIVE',
    is_current: true,
    created_by: 'engineer',
    approved_by: userId,
    approved_at: new Date().toISOString(),
  };
}
