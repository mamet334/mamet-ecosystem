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
 * Pasangan di kalimat bebas ("tahun ke-3 adalah 20,0%") diperiksa sejak uji mutu RAG putaran 5 — lihat
 * `periksaPasanganKalimat`.
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
  if (b.includes(j.slice(0, 30)) || (j.length <= 60 && j.includes(b) && b.length >= 4)) return true;
  // Akhiran berkas tidak wajib ditulis (uji chat 2026-09-14): `Sumber: Dokumen HCDP 2025-2026 Kabupaten OKU.`
  // untuk berkas "DOKUMEN HCDP 2025-2026.docx" diturunkan hanya karena ".docx". Nama tanpa akhiran minimal
  // 8 huruf, supaya berkas pendek ("Laporan.pdf") tidak cocok dengan sembarang kalimat.
  const tanpaAkhiran = rapikan(String(judul || '').replace(/\.(docx?|pdf|xlsx?|pptx?|txt|md|csv|rtf|odt)\s*$/i, ''));
  return tanpaAkhiran.length >= 8 && tanpaAkhiran !== j && b.includes(tanpaAkhiran.slice(0, 30));
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
  return periksaPasanganKalimat(teks, isi, peta);
}

// ── Pasangan angka–tahun di kalimat bebas ────────────────────────────────────────────────────
// Uji mutu RAG putaran 5 (HCDP-03 #1): "Target IP-ASN pada tahun 5 adalah 80%." tetap VERIFIED. Tabel program menulis
// 80,0 poin di kolom "Tahun 5"; "80%" di dokumen ada di tabel IKU kolom "Target". Semua pemeriksaan di atas hanya membaca
// tabel dan `Label: angka`, jadi kalimat biasa lolos. Keputusan Owner: pasangan di kalimat bebas ikut diperiksa.
// Sengaja sempit agar jawaban benar tidak turun: hanya kalimat yang memuat TEPAT SATU periode dan SATU angka, dan hanya
// diturunkan bila dokumen PUNYA kolom periode itu tetapi angkanya tidak ada di sana. Angka yang juga tertulis di teks
// biasa atau di baris tabel tanpa judul kolom tidak bisa dibuktikan salah → dibiarkan.
const URUTAN: Record<string, string> = {
  pertama: '1', kedua: '2', ketiga: '3', keempat: '4', kelima: '5',
  keenam: '6', ketujuh: '7', kedelapan: '8', kesembilan: '9', kesepuluh: '10'
};
const POLA_PERIODE = /\b(?:tahun|thn\.?)\s*(?:ke\s*-?\s*)?(\d{1,4}|pertama|kedua|ketiga|keempat|kelima|keenam|ketujuh|kedelapan|kesembilan|kesepuluh)\b/gi;
const KATA_KOLOM_PERIODE = new Set(['tahun', 'thn', 'th', 'ke', 'target']);

/** Judul kolom menunjuk periode itu: memuat nomornya dan selebihnya kata periode ("Tahun 5", "Thn 5", "2025", "Target 2025"). */
function kolomPeriode(nomor: string, judul: string[] | null): boolean {
  return !!judul && judul.includes(nomor) && judul.every((w) => w === nomor || KATA_KOLOM_PERIODE.has(w));
}

function periksaPasanganKalimat(teks: string, isi: string[], peta: Map<string, Kemunculan[]>): string | null {
  const kunciProsa = new Set(
    isi.join('\n').split('\n').filter((b) => !barisTabel(b)).flatMap((b) => (b.match(POLA_ANGKA) || []).map(kunciAngka))
  );
  const kolomAda = (nomor: string) => [...peta.values()].some((daftar) => daftar.some((t) => t.semuaJudul.some((j) => kolomPeriode(nomor, j))));

  const kalimat = teks.split('\n').filter((b) => !barisTabel(b)).flatMap((b) => bersihMarkdown(b).split(/(?<=[.!?])\s+/));
  for (const k of kalimat) {
    const periode = [...k.matchAll(POLA_PERIODE)];
    const nomor = [...new Set(periode.map((m) => URUTAN[m[1].toLowerCase()] || String(Number(m[1]))))];
    const angka = [...new Set((k.match(POLA_ANGKA) || []).map((a) => a.trim()))];
    if (nomor.length !== 1 || angka.length !== 1) continue;

    const kunci = kunciAngka(angka[0]);
    const tempat = peta.get(kunci);
    if (!tempat?.length || kunciProsa.has(kunci)) continue;
    const sah = tempat.some((t) => kolomPeriode(nomor[0], t.judulKolom) || labelDiBaris(['tahun', nomor[0]], t.barisKata));
    if (sah || tempat.some((t) => !t.judulKolom) || !kolomAda(nomor[0])) continue;
    return `angka ${angka[0]} ditulis untuk "${periode[0][0].trim()}", tetapi di tabel sumber angka itu tidak berada di kolom tahun ${nomor[0]}`;
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

// ── Rujukan peraturan ────────────────────────────────────────────────────────────────────────
// "Nomor 19 Tahun 2026" bukan desimal/persen, jadi lolos pemeriksaan angka. Uji chat 2026-09-14: potongan
// berita web terpotong `(PermenPANRB) Nomor 19 Tahun ...`, model melengkapinya menjadi "Nomor 19 Tahun 2026"
// dan tetap VERIFIED. Kini setiap "Nomor N Tahun YYYY" di jawaban wajib tertulis persis di potongan.
const POLA_RUJUKAN = /\b(?:nomor|no\.?)\s*(\d{1,4}[a-z]?)\s+tahun\s+(\d{4})\b/gi;

/** null = rujukan sah (atau tidak ada); string = alasan penurunan. */
export function periksaRujukanSumber(jawaban: string, isiDokumen: string[]): string | null {
  const isi = (isiDokumen || []).filter((t) => typeof t === 'string' && t.trim());
  if (!isi.length) return null;
  const teksIsi = rapikan(isi.join('\n'));
  const karangan = new Set<string>();
  for (const m of String(jawaban || '').matchAll(POLA_RUJUKAN)) {
    const n = m[1].toLowerCase(); const th = m[2];
    if (!teksIsi.includes(`nomor ${n} tahun ${th}`) && !teksIsi.includes(`no ${n} tahun ${th}`)) karangan.add(`Nomor ${m[1]} Tahun ${th}`);
  }
  if (!karangan.size) return null;
  return `rujukan ${[...karangan].slice(0, 3).join(', ')} tidak tertulis di dokumen yang dilampirkan`;
}

// ── Sumber berupa parafrase judul ────────────────────────────────────────────────────────────
// Uji mutu RAG putaran 5 (HCDP-07 #1): `Sumber: Dokumen Perencanaan Pengembangan Kompetensi ASN (Human Capital Development
// Plan/HCDP) Kabupaten Ogan Komering Ulu Tahun 2025–2026.` diturunkan walau isinya benar — 11 dari 17 katanya tertulis
// berurutan di dokumen, sisanya disusun model. Keputusan Owner: parafrase diterima bila SEBAGIAN BESAR teksnya cocok.
// Ukurannya deret kata BERURUTAN terpanjang (bukan kata tersebar, supaya kata-kata umum dokumen tak bisa dirangkai
// menjadi judul karangan): minimal 6 kata dan minimal 60% kata kutipan.
const PARAFRASE_MIN_KATA = 6;
const PARAFRASE_MIN_PORSI = 0.6;

/** q dan teks sudah dirapikan. */
export function parafraseDiIsi(q: string, teks: string): boolean {
  const kata = q.split(' ').filter(Boolean);
  const perlu = Math.max(PARAFRASE_MIN_KATA, Math.ceil(kata.length * PARAFRASE_MIN_PORSI));
  if (kata.length < perlu) return false;
  const t = ` ${teks} `;
  for (let i = 0; i + perlu <= kata.length; i++) {
    if (t.includes(` ${kata.slice(i, i + perlu).join(' ')} `)) return true;
  }
  return false;
}

// ── Tabel centang PDF (Item 88) ──────────────────────────────────────────────────────────────
// Uji live Item 87 (2026-09-16): "Ketiganya memiliki tingkat kepentingan 'Perlu'" berlabel VERIFIED, padahal
// koordinat PDF membuktikan "Penting" — tabel OCR menggeser kolom centang. Sejak Tahap 1 ekstraktor browser
// menempelkan blok fakta `[TABEL CENTANG — …] Kolom: A | B | C  - <baris> → B [/TABEL CENTANG]` dan penanda
// `[TABEL CENTANG TIDAK PASTI — …]`. Dua aturan:
//  1. BERTENTANGAN: jawaban menyebut nilai kolom (mis. "Perlu") untuk baris yang blok nyatakan bernilai lain.
//     Pasangan dinilai per JAWABAN, bukan per baris: model sungguhan menulis butir di baris-baris terpisah lalu
//     satu kalimat "Ketiganya … 'Perlu'". Baris blok dianggap dibahas bila ≥60% kata labelnya ada di jawaban.
//  2. TIDAK PASTI: potongan memuat penanda tidak pasti dan jawaban menyebut nilai kolom → tidak bisa VERIFIED.
const TANDA_BLOK_CENTANG = '[TABEL CENTANG';
const TANDA_TIDAK_PASTI = '[TABEL CENTANG TIDAK PASTI';

type EntriCentang = { kata: string[]; nilai: string[] };

/** Blok centang di potongan → nama kolom, entri (label → nilai), dan halaman bertanda tidak pasti. */
export function bacaBlokCentang(isiDokumen: string[]) {
  const kolom = new Set<string>();
  const entri: EntriCentang[] = [];
  const halamanTidakPasti: string[] = [];
  let adaTidakPasti = false;
  for (const isi of isiDokumen || []) {
    const t = String(isi || '');
    if (!t.includes(TANDA_BLOK_CENTANG) && !/^Kolom( \(judul tabel dari halaman \d+\))?: /m.test(t)) continue;
    let halaman = '';
    let dalamTidakPasti = false;
    for (const baris of t.split('\n')) {
      const hal = baris.match(/^\[Halaman\s+(\d+)\]/);
      if (hal) halaman = hal[1];
      if (baris.startsWith(TANDA_TIDAK_PASTI)) {
        dalamTidakPasti = true; adaTidakPasti = true;
        if (halaman && !halamanTidakPasti.includes(halaman)) halamanTidakPasti.push(halaman);
        continue;
      }
      if (/^\[\/TABEL CENTANG( TIDAK PASTI)?\]/.test(baris)) { dalamTidakPasti = false; continue; }
      const k = baris.match(/^Kolom(?: \(judul tabel dari halaman \d+\))?: (.+)$/);
      if (k) { k[1].split('|').map((s) => s.trim()).filter(Boolean).forEach((s) => kolom.add(s)); continue; }
      const kol = baris.match(/tanda centang di kolom "([^"]+)"/);
      if (kol) kolom.add(kol[1]);
      if (dalamTidakPasti) continue;
      const e = baris.match(/^- (?:\(label perkiraan\) )?(.+?) → ([^→]+)$/);
      if (!e) continue;
      const nilai = e[2].split(',').map((s) => s.trim()).filter(Boolean);
      nilai.forEach((s) => kolom.add(s));
      // Nomor butir ("2.", "1") bukan kata label.
      const kata = kataLabel(e[1]).filter((w) => !/^\d+$/.test(w));
      if (kata.length >= 2) entri.push({ kata, nilai });
    }
  }
  return { kolom: [...kolom], entri, adaTidakPasti, halamanTidakPasti };
}

/** null = sah; string = alasan penurunan. */
export function periksaTabelCentang(jawaban: string, isiDokumen: string[]): string | null {
  const { kolom, entri, adaTidakPasti, halamanTidakPasti } = bacaBlokCentang(isiDokumen);
  if (!kolom.length) return null;
  // Nama kolom dicari PERSIS hurufnya ("Perlu", bukan "perlu") dan bukan di awal kalimat — "Anda perlu
  // mengecek…" / "Penting dicatat…" adalah kalimat biasa, bukan nilai kolom.
  const polaKolom = new Map(kolom.map((k) => [k, new RegExp(
    `(?<![\\p{L}\\p{N}])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'gu')]));
  const menyebut = (baris: string, k: string) => [...baris.matchAll(polaKolom.get(k)!)].some((m) => {
    const depan = baris.slice(0, m.index);
    const awalKalimat = /(^|[.!?]\s+)[\s>#\-•\d.)]*$/.test(bersihMarkdown(depan));
    return !awalKalimat || /["“'*]\s*$/.test(depan);   // "Perlu" / **Perlu** di awal tetap nilai kolom
  });
  // Baris yang menyebut SEMUA nama kolom sekaligus ("terdiri dari Mutlak, Penting, Perlu") hanya menjelaskan
  // skala, bukan menilai baris tertentu — tidak dihitung.
  const disebut = new Set<string>();
  for (const baris of String(jawaban || '').split('\n')) {
    const ada = kolom.filter((k) => menyebut(baris, k));
    if (kolom.length >= 2 && ada.length === kolom.length) continue;
    ada.forEach((k) => disebut.add(k));
  }
  if (!disebut.size) return null;

  const kataJawaban = new Set(kataLabel(jawaban));
  const dibahas = entri.filter((e) => e.kata.filter((w) => kataJawaban.has(w)).length / e.kata.length >= 0.6);
  if (dibahas.length) {
    const sah = new Set(dibahas.flatMap((e) => e.nilai));
    const salah = [...disebut].filter((k) => !sah.has(k));
    if (salah.length) {
      return `nilai kolom "${salah.join('", "')}" bertentangan dengan blok TABEL CENTANG (dibaca dari posisi tanda di PDF: ${[...sah].join(', ')})`;
    }
  }
  if (adaTidakPasti) {
    const hal = halamanTidakPasti.length ? ` halaman ${halamanTidakPasti.join(', ')}` : '';
    return `potongan sumber memuat penanda TABEL CENTANG TIDAK PASTI${hal} — kolom tanda centang di sana tidak bisa dipastikan`;
  }
  return null;
}

export type HasilLabel ={ jawaban: string; dikoreksi: boolean; alasan: string; catatan: string };

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
  // Blok <think>…</think> SENGAJA ditampilkan di chat (transparansi, keputusan Owner 2026-09-14), tetapi label
  // menilai JAWABAN AKHIR saja: label, Sumber, halaman, rujukan, dan angka dibaca di LUAR nalar. Keputusan Owner
  // (uji mutu RAG putaran 4) menggantikan `0a50452` yang ikut memeriksa nalar: HCDP-07 #1 diturunkan hanya karena
  // model mengecek di nalar "3.548 + 1.164 = 4.712, tidak sama dengan 4.828" — jawaban akhirnya bersih.
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
  // Tanpa tanda kutip juga diterima (uji mutu RAG putaran 4, KAT-02 #2): `Sumber: Katalog Kurikulum FEB, FHISIP, …`
  // — sisa baris sesudah "Sumber:" harus tertulis utuh di isi potongan (≥20 huruf setelah dirapikan).
  const kutipanDiIsi = isiRapi.length > 0 && [
    ...[...tampil.matchAll(/sumber\s*:?\s*["“]([^"”\n]{8,300})["”]/gi)].map((m) => m[1]),
    ...[...tampil.matchAll(/sumber\s*:\s*([^"“”\n]{20,300})$/gim)].map((m) => m[1].replace(/[.\s]+$/, ''))
  ]
    .map((q) => rapikan(q))
    .some((q) => q.length >= 20 && isiRapi.some((t) => t.includes(q) || parafraseDiIsi(q, t)));
  const adaYangCocok = judul.length > 0 && (kutipanDiIsi || kutipan.some((k) => judul.some((j) => judulDisebut(k, j))));
  if (!adaYangCocok) {
    const alasan = judul.length === 0
      ? 'tidak ada dokumen yang dilampirkan'
      : (kutipan.length === 0 ? 'jawaban tidak menyebut Sumber' : 'judul di dekat kata Sumber tidak cocok dengan dokumen yang dilampirkan');
    return turunkan(alasan, CATATAN_KOREKSI);
  }

  const alasanHalaman = periksaHalamanSumber(tampil, isiDokumen);
  if (alasanHalaman) return turunkan(alasanHalaman, `_Catatan sistem: label VERIFIED diturunkan — ${alasanHalaman}._`);

  const alasanRujukan = periksaRujukanSumber(tampil, isiDokumen);
  if (alasanRujukan) return turunkan(alasanRujukan, `_Catatan sistem: label VERIFIED diturunkan — ${alasanRujukan}. Periksa rujukan ini langsung di sumbernya._`);

  const alasanAngka = periksaAngkaSumber(tampil, isiDokumen);
  if (alasanAngka) return turunkan(alasanAngka, `_Catatan sistem: label VERIFIED diturunkan — ${alasanAngka}. Periksa angka ini langsung di dokumen._`);

  const alasanCentang = periksaTabelCentang(tampil, isiDokumen);
  if (alasanCentang) return turunkan(alasanCentang, `_Catatan sistem: label VERIFIED diturunkan — ${alasanCentang}. Periksa tingkat/kolom ini langsung di dokumen asli._`);
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
