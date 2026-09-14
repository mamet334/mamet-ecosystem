/**
 * LABEL VERIFIED WAJIB MENYEBUT SUMBERNYA (Item 71, 2026-09-12)
 *
 * Sebelum item ini, `[BLOK 6]` memerintahkan label `[STATUS: VERIFIED]` **tanpa syarat** setiap kali
 * Evidence Gate berstatus PASSED — dan PASSED hanya berarti "ada dokumen yang dilampirkan".
 * Perintah itu bertentangan dengan panduan identitas (`request_pipeline.ts`), yang menulis VERIFIED
 * hanya "jika didukung oleh dokumen". Akibatnya terbukti di Item 70: satu chat menerima potongan
 * yang TIDAK memuat jawabannya (skor 0,552), jawabannya datang dari pengetahuan umum model, tapi
 * labelnya `VERIFIED`. Label itu justru menghapus tanda bahaya yang seharusnya dilihat Owner.
 *
 * Kini VERIFIED wajib disertai baris `Sumber: "<judul dokumen>"`, dan kode ini memeriksanya:
 * judul yang disebut harus benar-benar ada di antara dokumen yang dilampirkan. Kalau tidak,
 * labelnya diturunkan menjadi HYPOTHESIS — keputusan kode, bukan kesopanan model.
 *
 * ANGKA JUGA DIPERIKSA (Item 77, 2026-09-14). Menyebut judul yang benar belum berarti isinya benar:
 * HCDP ditanya "target rasio JF bersertifikat tahun 3", model menjawab 35,0% (seharusnya 20,0%)
 * dengan `Sumber: "DOKUMEN HCDP 2025-2026.docx"` yang cocok → tetap VERIFIED. Semua angkanya ADA di
 * dokumen; yang salah pasangannya — potongan yang dibaca memuat baris
 * `| 5 | Rasio … | % | 5,93% | 12,0% | 20,0% | 35,0% | … |` TANPA judul kolom, lalu model menebak
 * `Tahun 1 = 12,0%`. Maka bila isi dokumen yang dilampirkan diberikan, VERIFIED juga mensyaratkan:
 *  1. setiap angka berdesimal/persen di jawaban ada di dokumen;
 *  2. setiap angka yang ditulis jawaban bersama labelnya (baris tabel, `Label: angka`) cocok dengan
 *     tabel sumber: tak ada label yang sama dengan judul kolom LAIN, dan minimal satu label = judul
 *     kolom sel itu atau disebut di baris yang sama. Bila judul kolom sumber tidak ada di konteks dan
 *     labelnya tidak ada di baris itu, pasangan tidak bisa dibuktikan.
 * Batas: pasangan di kalimat bebas ("tahun ke-3 adalah 20,0%") belum diperiksa.
 *
 * NOMOR HALAMAN JUGA DIPERIKSA (Item 77, uji live web 2026-09-14). Jawaban benar HCDP ditulis
 * `Sumber: "DOKUMEN HCDP 2025-2026.docx" [Halaman 1]` — padahal .docx tidak punya penanda halaman dan
 * potongan yang dibaca model tidak memuat `[Halaman …]`; "Halaman 1" dikarang. Nomor halaman yang
 * disebut jawaban kini harus ada sebagai penanda `[Halaman N]` di potongan, atau tertulis "halaman N"
 * di teks dokumen itu sendiri.
 *
 * JAWABAN TANPA LABEL (Item 77, uji live web 2026-09-14 07.33 UTC). Sesudah pemeriksaan halaman dideploy,
 * jawaban benar HCDP tersimpan TANPA label status sama sekali, walau BLOK 6 mewajibkannya dan kontrak
 * dipasang untuk semua mode. Semua pemeriksaan di atas hanya bekerja bila ada `[STATUS: VERIFIED]`, jadi
 * TIDAK menulis label adalah jalan lolos. Kini: bila dokumen dilampirkan dan jawaban tanpa label apa pun,
 * sistem menambahkan HYPOTHESIS + catatan (VERIFIED tidak pernah ditambahkan otomatis). Varian penulisan
 * label VERIFIED (`[Status: Verified]`) disamakan dulu agar tidak lolos dari pemeriksaan.
 */
export const LABEL_VERIFIED = '[STATUS: VERIFIED]';
export const LABEL_HIPOTESIS = '[STATUS: HYPOTHESIS - Rekomendasi AI]';
export const CATATAN_KOREKSI = '_Catatan sistem: label VERIFIED diturunkan — jawaban ini tidak mengutip dokumen yang tersedia._';
export const CATATAN_TANPA_LABEL = '_Catatan sistem: model tidak menulis label status — jawaban ini belum diverifikasi sistem terhadap dokumen yang tersedia._';

const rapikan = (s: string) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** Judul dianggap disebut bila 30 huruf pertamanya (setelah dirapikan) muncul di baris Sumber. */
function judulDisebut(baris: string, judul: string): boolean {
  const j = rapikan(judul);
  if (j.length < 4) return false;
  const b = rapikan(baris);
  return b.includes(j.slice(0, 30)) || (j.length <= 60 && j.includes(b) && b.length >= 4);
}

// ── Angka ────────────────────────────────────────────────────────────────────────────────────
// Hanya angka berdesimal/berpemisah atau berpersen: nomor urut, "tahun 3", dan "2025-2026" tidak.
const POLA_ANGKA = /\d+(?:[.,]\d+)+(?:\s?%)?|\d+\s?%/g;
const ANGKA_PENUH = /^\d+(?:[.,]\d+)+(?:\s?%)?$|^\d+\s?%$/;

/** Kunci pembanding: `47,60%` = `47,6%`, `12,0%` = `12%`, titik dan koma disamakan. */
export function kunciAngka(s: string): string {
  let t = String(s).replace(/\s+/g, '');
  const persen = t.endsWith('%');
  if (persen) t = t.slice(0, -1);
  t = t.replace(/\./g, ',');
  const i = t.lastIndexOf(',');
  if (i >= 0) {
    const pecahan = t.slice(i + 1).replace(/0+$/, '');
    t = t.slice(0, i) + (pecahan ? `,${pecahan}` : '');
  }
  return t + (persen ? '%' : '');
}

const bersihMarkdown = (s: string) => String(s || '').replace(/[*_`]/g, '').trim();

/** Kata label: huruf/angka ≥2 atau digit tunggal; "ke-3" dianggap "3". */
function kataLabel(s: string): string[] {
  return rapikan(bersihMarkdown(s).replace(/\bke-(?=\d)/gi, ''))
    .split(' ')
    .filter((w) => w.length >= 2 || /^\d$/.test(w));
}
const samaKata = (a: string[], b: string[] | null) => !!b && a.length > 0 && a.length === b.length && a.every((w) => b.includes(w));
/** Label "disebut" di baris sumber bila ≥60% katanya ada di baris itu. */
function labelDiBaris(label: string[], barisKata: Set<string>): boolean {
  if (!label.length) return false;
  return label.filter((w) => barisKata.has(w)).length / label.length >= 0.6;
}

// Baris tabel boleh berawalan pembungkus pendek (`: "| No |` di tampilan konteks) dan diakhiri kutip.
const barisTabel = (baris: string) => /^[^|\n]{0,4}\|/.test(baris);
const polosTabel = (baris: string) => baris.replace(/^[^|\n]{0,4}(?=\|)/, '').replace(/\|\s*"\s*$/, '|').trim();
const selTabel = (baris: string) => polosTabel(baris).replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
const barisPemisah = (baris: string) => /^\|(\s*:?-{3,}:?\s*\|)+$/.test(polosTabel(baris));

type Kemunculan = { judulKolom: string[] | null; semuaJudul: string[][]; barisKata: Set<string> };

/** Peta kunciAngka → tempat angka itu muncul sebagai SEL tabel Markdown di dokumen. */
function petaSelAngka(isiDokumen: string[]): Map<string, Kemunculan[]> {
  const peta = new Map<string, Kemunculan[]>();
  for (const isi of isiDokumen) {
    const baris = String(isi || '').split('\n');
    for (let i = 0; i < baris.length; i++) {
      if (!barisTabel(baris[i])) continue;
      let akhir = i;
      while (akhir + 1 < baris.length && barisTabel(baris[akhir + 1])) akhir++;
      const blok = baris.slice(i, akhir + 1);
      const iPemisah = blok.findIndex(barisPemisah);
      const judul = iPemisah >= 1 ? selTabel(blok[iPemisah - 1]) : null;
      const semuaJudul = judul ? judul.map(kataLabel).filter((j) => j.length) : [];
      for (const b of blok.slice(iPemisah >= 0 ? iPemisah + 1 : 0)) {
        if (barisPemisah(b)) continue;
        const sel = selTabel(b);
        const barisKata = new Set(kataLabel(sel.filter((c) => !ANGKA_PENUH.test(c)).join(' ')));
        sel.forEach((c, k) => {
          if (!ANGKA_PENUH.test(c)) return;
          const kunci = kunciAngka(c);
          if (!peta.has(kunci)) peta.set(kunci, []);
          peta.get(kunci)!.push({ judulKolom: judul ? kataLabel(judul[k] || '') : null, semuaJudul, barisKata });
        });
      }
      i = akhir;
    }
  }
  return peta;
}

type Pasangan = { label: string[]; teksLabel: string; angka: string };

/** Angka yang ditulis jawaban beserta labelnya: sel tabel Markdown (label = sel teks sebaris + judul kolom tabel jawaban) dan baris `Label: angka`. */
function pasanganJawaban(teks: string): Pasangan[] {
  const hasil: Pasangan[] = [];
  const baris = teks.split('\n');
  let judulJawaban: string[] | null = null;
  for (let i = 0; i < baris.length; i++) {
    const b = baris[i];
    if (barisTabel(b)) {
      if (barisPemisah(b)) continue;
      if (i + 1 < baris.length && barisPemisah(baris[i + 1])) { judulJawaban = selTabel(b).map(bersihMarkdown); continue; }
      const sel = selTabel(b).map(bersihMarkdown);
      const labelSebaris = sel.filter((c) => c && !ANGKA_PENUH.test(c));
      sel.forEach((c, k) => {
        if (!ANGKA_PENUH.test(c)) return;
        const kandidat = [...labelSebaris, judulJawaban?.[k] || ''].filter(Boolean);
        for (const l of kandidat) hasil.push({ label: kataLabel(l), teksLabel: l, angka: c });
      });
      continue;
    }
    judulJawaban = null;
    const m = bersihMarkdown(b).match(/^\s*(?:[-•]\s*)?([^:=|]{2,60}?)\s*[:=]\s*(\d+(?:[.,]\d+)+(?:\s?%)?|\d+\s?%)\s*$/);
    if (m) hasil.push({ label: kataLabel(m[1]), teksLabel: m[1].trim(), angka: m[2] });
  }
  return hasil.filter((p) => p.label.length);
}

/** null = angka sah; string = alasan penurunan. */
export function periksaAngkaSumber(jawaban: string, isiDokumen: string[]): string | null {
  const isi = (isiDokumen || []).filter((t) => typeof t === 'string' && t.trim());
  if (!isi.length) return null;
  // Baris Sumber tidak ikut diperiksa (judul berkas bisa memuat angka versi).
  const teks = String(jawaban || '').split('\n').filter((b) => !/sumber\s*:/i.test(b)).join('\n');

  const kunciDokumen = new Set((isi.join('\n').match(POLA_ANGKA) || []).map(kunciAngka));
  const hilang = [...new Set((teks.match(POLA_ANGKA) || []).filter((a) => !kunciDokumen.has(kunciAngka(a))))];
  if (hilang.length) return `angka ${hilang.slice(0, 3).join(', ')} tidak ada di dokumen yang dilampirkan`;

  const peta = petaSelAngka(isi);
  // Satu angka di jawaban dinilai bersama SEMUA labelnya: sel teks sebaris + judul kolom tabel jawaban.
  const barisJawaban = teks.split('\n');
  let judulJawaban: string[] | null = null;
  const kelompok: { angka: string; label: Pasangan[] }[] = [];
  for (let i = 0; i < barisJawaban.length; i++) {
    const b = barisJawaban[i];
    if (!barisTabel(b)) {
      judulJawaban = null;
      kelompok.push(...pasanganJawaban(b).map((p) => ({ angka: p.angka, label: [p] })));
      continue;
    }
    if (barisPemisah(b)) continue;
    if (i + 1 < barisJawaban.length && barisPemisah(barisJawaban[i + 1])) { judulJawaban = selTabel(b).map(bersihMarkdown); continue; }
    const selJawaban = selTabel(b).map(bersihMarkdown);
    const labelSebaris = selJawaban.filter((c) => c && !ANGKA_PENUH.test(c));
    selJawaban.forEach((c, k) => {
      if (!ANGKA_PENUH.test(c)) return;
      const label = [...labelSebaris, judulJawaban?.[k] || '']
        .filter(Boolean)
        .map((l) => ({ label: kataLabel(l), teksLabel: l, angka: c }))
        .filter((p) => p.label.length);
      if (label.length) kelompok.push({ angka: c, label });
    });
  }

  for (const { angka, label } of kelompok) {
    const tempat = peta.get(kunciAngka(angka));
    if (!tempat?.length) continue; // angka hanya ada di teks biasa, bukan sel tabel — tak ada kolom untuk dicocokkan
    let sah = false; let bentrok: Pasangan | null = null; let takTerbukti: Pasangan | null = null;
    for (const t of tempat) {
      // Tabel sumber tanpa judul kolom: label berangka ("Tahun 1", "2025", "Semester 2") biasanya menunjuk
      // KOLOM. Bila tak disebut di baris itu, posisinya hanya tebakan — walau label lain (mis. judul kolom
      // tabel jawaban "Target Rasio …") cocok dengan nama baris. Kasus produksi 35,0% lolos tanpa aturan ini.
      if (!t.judulKolom) {
        const tebakan = label.find((p) => /\d/.test(p.teksLabel) && !labelDiBaris(p.label, t.barisKata));
        if (tebakan) { takTerbukti = takTerbukti || tebakan; continue; }
      }
      const lawan = label.find((p) => t.judulKolom && !samaKata(p.label, t.judulKolom) && t.semuaJudul.some((j) => samaKata(p.label, j)));
      const cocok = label.some((p) => labelDiBaris(p.label, t.barisKata) || samaKata(p.label, t.judulKolom));
      if (cocok && !lawan) { sah = true; break; }
      if (lawan) bentrok = bentrok || lawan;
      else if (!t.judulKolom) takTerbukti = takTerbukti || label[0];
    }
    if (sah) continue;
    if (bentrok) return `angka ${angka} ditulis untuk "${bentrok.teksLabel}", tetapi di tabel sumber angka itu berada di kolom lain`;
    if (takTerbukti) return `pasangan "${takTerbukti.teksLabel}" = ${angka} tidak bisa dibuktikan — judul kolom tabel sumbernya tidak ada di dokumen yang dibaca`;
  }
  return null;
}

// `[Halaman 12]`, `Halaman 12–14`, `hlm. 12`, `hal. 12`, `page 12` — "hal ini" tidak (butuh titik + angka).
const POLA_HALAMAN = /\b(?:halaman|hlm\.?|hal\.|page)\s*(\d{1,4})(?:\s*[-–—]\s*(\d{1,4}))?/gi;

/** null = kutipan halaman sah (atau tidak ada); string = alasan penurunan. */
export function periksaHalamanSumber(jawaban: string, isiDokumen: string[]): string | null {
  const isi = (isiDokumen || []).filter((t) => typeof t === 'string' && t.trim());
  if (!isi.length) return null;
  const disebut = new Set<string>();
  for (const m of String(jawaban || '').matchAll(POLA_HALAMAN)) {
    disebut.add(String(Number(m[1])));
    if (m[2]) disebut.add(String(Number(m[2])));
  }
  if (!disebut.size) return null;
  const teksIsi = isi.join('\n');
  const penanda = new Set([...teksIsi.matchAll(/\[Halaman\s+(\d{1,4})\]/gi)].map((m) => String(Number(m[1]))));
  const tertulis = new Set([...teksIsi.matchAll(POLA_HALAMAN)].map((m) => String(Number(m[1]))));
  const karangan = [...disebut].filter((n) => !penanda.has(n) && !tertulis.has(n));
  if (!karangan.length) return null;
  return penanda.size
    ? `nomor halaman ${karangan.join(', ')} tidak ada di dokumen yang dilampirkan (penanda yang ada: ${[...penanda].slice(0, 5).join(', ')})`
    : `nomor halaman ${karangan.join(', ')} disebut, padahal dokumen yang dilampirkan tidak memuat penanda halaman`;
}

export type HasilLabel = { jawaban: string; dikoreksi: boolean; alasan: string; catatan: string };

/**
 * @param jawaban teks jawaban model
 * @param judulDokumen judul dokumen/artikel yang BENAR-BENAR dilampirkan ke prompt
 * @param isiDokumen isi potongan yang dilampirkan (opsional) — bila ada, angka dan pasangannya ikut diperiksa
 */
export function periksaLabelSumber(jawaban: string, judulDokumen: string[], isiDokumen: string[] = []): HasilLabel {
  // Varian huruf/spasi label VERIFIED disamakan dulu — kalau tidak, `[Status: Verified]` lolos dari semua pemeriksaan.
  const teks = String(jawaban || '').replace(/\[\s*status\s*:\s*verified\s*\]/gi, LABEL_VERIFIED);
  const diam: HasilLabel = { jawaban: teks, dikoreksi: false, alasan: '', catatan: '' };
  const judul = (judulDokumen || []).filter((j) => typeof j === 'string' && j.trim());
  // Blok <think>…</think> diperintahkan request_pipeline dan SENGAJA ditampilkan di chat utama (transparansi,
  // keputusan Owner 2026-09-14). Label dan Sumber harus tertulis di jawaban akhir, di LUAR nalar — label/Sumber
  // yang hanya ada di dalam nalar tidak meloloskan VERIFIED. Halaman & angka tetap diperiksa pada SELURUH teks,
  // karena nalar ikut dibaca pengguna.
  const tampil = teks.replace(/<think>[\s\S]*?<\/think>/gi, '');

  // Dokumen dilampirkan → kontrak BLOK 6 mewajibkan label. Tanpa label apa pun → HYPOTHESIS ditambahkan sistem.
  const adaLabel = /\[\s*status\s*:/i.test(tampil) || tampil.includes('[Pengetahuan umum AI');
  if (!adaLabel) {
    if (!judul.length) return diam;
    return { jawaban: `${teks.trimEnd()}\n\n${LABEL_HIPOTESIS}`, dikoreksi: true, alasan: 'model tidak menulis label status', catatan: CATATAN_TANPA_LABEL };
  }

  if (!tampil.includes(LABEL_VERIFIED)) return diam;
  const turunkan = (alasan: string, catatan: string): HasilLabel => ({
    jawaban: teks.split(LABEL_VERIFIED).join(LABEL_HIPOTESIS), dikoreksi: true, alasan, catatan
  });
  // Kutipan sumber dicari di MANA SAJA, bukan hanya di awal baris: pada uji produksi pertama
  // (2026-09-12) model menulis `[STATUS: VERIFIED] — Sumber: "judul…"` di SATU baris dengan label,
  // dan aturan "baris harus dimulai dengan Sumber" menurunkan label yang sebenarnya sah.
  // Tiap kemunculan kata "sumber" dibuka 300 huruf ke depan, lalu dicari judul yang cocok di sana.
  const JANGKAUAN = 300;
  const kutipan: string[] = [];
  const pola = /sumber/gi;
  let temu: RegExpExecArray | null;
  while ((temu = pola.exec(tampil)) !== null) kutipan.push(tampil.slice(temu.index, temu.index + JANGKAUAN));
  // Judul di DALAM dokumen juga sah (uji mutu RAG 2026-09-14): model menulis
  // `Sumber: "DOKUMEN PERENCANAAN PENGEMBANGAN KOMPETENSI ASN … (HCDP) …"` atau
  // `Sumber: "Katalog Kurikulum FEB, FHISIP, FKIP …"` — judul sampul/tajuk halaman, bukan nama berkas —
  // dan 5 jawaban benar diturunkan. Teks yang dikutip dianggap cocok bila tertulis di isi potongan yang
  // dilampirkan (≥20 huruf setelah dirapikan). Pemeriksaan halaman & angka tetap berjalan sesudahnya.
  const isiRapi = (isiDokumen || []).filter((t) => typeof t === 'string' && t.trim()).map(rapikan);
  const kutipanDiIsi = isiRapi.length > 0 && [...tampil.matchAll(/sumber\s*:?\s*["“]([^"”\n]{8,300})["”]/gi)]
    .map((m) => rapikan(m[1]))
    .some((q) => q.length >= 20 && isiRapi.some((t) => t.includes(q)));
  const adaYangCocok = judul.length > 0 && (kutipanDiIsi || kutipan.some((k) => judul.some((j) => judulDisebut(k, j))));
  if (!adaYangCocok) {
    const alasan = judul.length === 0
      ? 'tidak ada dokumen yang dilampirkan'
      : (kutipan.length === 0 ? 'jawaban tidak menyebut Sumber' : 'judul di dekat kata Sumber tidak cocok dengan dokumen yang dilampirkan');
    return turunkan(alasan, CATATAN_KOREKSI);
  }

  const alasanHalaman = periksaHalamanSumber(teks, isiDokumen);
  if (alasanHalaman) return turunkan(alasanHalaman, `_Catatan sistem: label VERIFIED diturunkan — ${alasanHalaman}._`);

  const alasanAngka = periksaAngkaSumber(teks, isiDokumen);
  if (alasanAngka) return turunkan(alasanAngka, `_Catatan sistem: label VERIFIED diturunkan — ${alasanAngka}. Periksa angka ini langsung di dokumen._`);
  return diam;
}

/** Dipakai jalur non-stream: mengoreksi teks sekaligus mencatat alasannya. */
export function koreksiLabel(jawaban: string, judulDokumen: string[], mode: string, isiDokumen: string[] = []): string {
  const hasil = periksaLabelSumber(jawaban, judulDokumen, isiDokumen);
  if (hasil.dikoreksi) {
    console.warn(`[LABEL] ${mode}: VERIFIED -> HYPOTHESIS (${hasil.alasan}); dokumen dilampirkan: ${judulDokumen?.length ?? 0}`);
    return `${hasil.jawaban}\n\n${hasil.catatan}`;
  }
  return hasil.jawaban;
}
