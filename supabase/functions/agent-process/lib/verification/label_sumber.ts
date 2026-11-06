import { putuskanKlaim, ringkasTakBersandar } from './klaim_sumber.ts';

export const LABEL_VERIFIED = '[STATUS: VERIFIED]';
export const LABEL_HIPOTESIS = '[STATUS: HYPOTHESIS - Rekomendasi AI]';
export const LABEL_PARSIAL = '[STATUS: PARTIAL - Sebagian Bersandar Dokumen]';
export const CATATAN_KOREKSI = '_Catatan sistem: label VERIFIED diturunkan — jawaban ini tidak mengutip dokumen yang tersedia._';
export const CATATAN_TANPA_LABEL = '_Catatan sistem: model tidak menulis label status — jawaban ini belum diverifikasi sistem terhadap dokumen yang tersedia._';

export function catatanRagTurun(sebab: unknown): string {
  if (!sebab) return '';
  const s = String(sebab).replace(/[\r\n_]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
  return `_Catatan sistem: pencarian makna dokumen tidak jalan (${s}) — dokumen dicari lewat pencocokan kata, jadi sumber yang sebenarnya ada bisa terlewat._`;
}

const rapikan = (s: string) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

function judulDisebut(baris: string, judul: string): boolean {
  const j = rapikan(judul);
  if (j.length < 4) return false;
  const b = rapikan(baris);
  if (b.includes(j.slice(0, 30)) || (j.length <= 60 && j.includes(b) && b.length >= 4)) return true;
  const tanpaAkhiran = rapikan(String(judul || '').replace(/\.(docx?|pdf|xlsx?|pptx?|txt|md|csv|rtf|odt)\s*$/i, ''));
  return tanpaAkhiran.length >= 8 && tanpaAkhiran !== j && b.includes(tanpaAkhiran.slice(0, 30));
}

const POLA_ANGKA = /\d+(?:[.,]\d+)+(?:\s?%)?|\d+\s?%/g;
const ANGKA_PENUH = /^\d+(?:[.,]\d+)+(?:\s?%)?$|^\d+\s?%$/;

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

function kataLabel(s: string): string[] {
  return rapikan(bersihMarkdown(s).replace(/\bke-(?=\d)/gi, ''))
    .split(' ')
    .filter((w) => w.length >= 2 || /^\d$/.test(w));
}
const samaKata = (a: string[], b: string[] | null) => !!b && a.length > 0 && a.length === b.length && a.every((w) => b.includes(w));
function labelDiBaris(label: string[], barisKata: Set<string>): boolean {
  if (!label.length) return false;
  return label.filter((w) => barisKata.has(w)).length / label.length >= 0.6;
}

const barisTabel = (baris: string) => /^[^|\n]{0,4}\|/.test(baris);
const polosTabel = (baris: string) => baris.replace(/^[^|\n]{0,4}(?=\|)/, '').replace(/\|\s*"\s*$/, '|').trim();
const selTabel = (baris: string) => polosTabel(baris).replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
const barisPemisah = (baris: string) => /^\|(\s*:?-{3,}:?\s*\|)+$/.test(polosTabel(baris));

type Kemunculan = { judulKolom: string[] | null; semuaJudul: string[][]; barisKata: Set<string> };

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

export function periksaAngkaSumber(jawaban: string, isiDokumen: string[]): string | null {
  const isi = (isiDokumen || []).filter((t) => typeof t === 'string' && t.trim());
  if (!isi.length) return null;
  const teks = String(jawaban || '').split('\n').filter((b) => !/sumber\s*:/i.test(b)).join('\n');

  const kunciDokumen = new Set((isi.join('\n').match(POLA_ANGKA) || []).map(kunciAngka));
  const hilang = [...new Set((teks.match(POLA_ANGKA) || []).filter((a) => !kunciDokumen.has(kunciAngka(a))))];
  if (hilang.length) return `angka ${hilang.slice(0, 3).join(', ')} tidak ada di dokumen yang dilampirkan`;

  const peta = petaSelAngka(isi);
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
    if (!tempat?.length) continue;
    let sah = false; let bentrok: Pasangan | null = null; let takTerbukti: Pasangan | null = null;
    for (const t of tempat) {
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

const URUTAN: Record<string, string> = {
  pertama: '1', kedua: '2', ketiga: '3', keempat: '4', kelima: '5',
  keenam: '6', ketujuh: '7', kedelapan: '8', kesembilan: '9', kesepuluh: '10'
};
const POLA_PERIODE = /\b(?:tahun|thn\.?)\s*(?:ke\s*-?\s*)?(\d{1,4}|pertama|kedua|ketiga|keempat|kelima|keenam|ketujuh|kedelapan|kesembilan|kesepuluh)\b/gi;
const KATA_KOLOM_PERIODE = new Set(['tahun', 'thn', 'th', 'ke', 'target']);

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

const POLA_HALAMAN = /\b(?:halaman|hlm\.?|hal\.|page)\s*(\d{1,4})(?:\s*[-–—]\s*(\d{1,4}))?/gi;

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

const POLA_RUJUKAN = /\b(?:nomor|no\.?)\s*(\d{1,4}[a-z]?)\s+tahun\s+(\d{4})\b/gi;

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

const PARAFRASE_MIN_KATA = 6;
const PARAFRASE_MIN_PORSI = 0.6;

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

const TANDA_BLOK_CENTANG = '[TABEL CENTANG';
const TANDA_TIDAK_PASTI = '[TABEL CENTANG TIDAK PASTI';

type EntriCentang = { kata: string[]; nilai: string[] };

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
      const kata = kataLabel(e[1]).filter((w) => !/^\d+$/.test(w));
      if (kata.length >= 2) entri.push({ kata, nilai });
    }
  }
  return { kolom: [...kolom], entri, adaTidakPasti, halamanTidakPasti };
}

export function periksaTabelCentang(jawaban: string, isiDokumen: string[]): string | null {
  const { kolom, entri, adaTidakPasti, halamanTidakPasti } = bacaBlokCentang(isiDokumen);
  if (!kolom.length) return null;
  const polaKolom = new Map(kolom.map((k) => [k, new RegExp(
    `(?<![\\p{L}\\p{N}])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'gu')]));
  const menyebut = (baris: string, k: string) => [...baris.matchAll(polaKolom.get(k)!)].some((m) => {
    const depan = baris.slice(0, m.index);
    const awalKalimat = /(^|[.!?]\s+)[\s>#\-•\d.)]*$/.test(bersihMarkdown(depan));
    return !awalKalimat || /["“'*]\s*$/.test(depan);
  });
  const kalimat = String(jawaban || '').split('\n').flatMap((b) => b.split(/(?<=[.!?])\s+/));
  const kataJawaban = new Set(kataLabel(jawaban));
  const dibahasJawaban = entri.filter((e) => e.kata.filter((w) => kataJawaban.has(w)).length / e.kata.length >= 0.6);
  const semuaNilai = new Set(entri.flatMap((e) => e.nilai));
  const nilaiDari = (daftar: EntriCentang[]) => new Set(daftar.flatMap((e) => e.nilai));
  const UMUM = new Set(['jabatan', 'pernah', 'memiliki', 'tingkat', 'kepentingan', 'persyaratan', 'dengan', 'untuk', 'sesuai', 'bidang', 'terhadap']);
  const kataNamaKolom = new Set(kolom.flatMap(kataLabel));
  const khas = (w: string) => w.length >= 5 && !UMUM.has(w) && !kataNamaKolom.has(w);

  for (const s of kalimat) {
    const ada = kolom.filter((k) => menyebut(s, k));
    if (!ada.length || (kolom.length >= 2 && ada.length === kolom.length)) continue;
    if (entri.length) {
      const asing = ada.filter((k) => !semuaNilai.has(k));
      if (asing.length) {
        return `nilai kolom "${asing.join('", "')}" tidak dimiliki baris mana pun di blok TABEL CENTANG (dibaca dari posisi tanda di PDF), padahal jawaban menyebutnya`;
      }
    }
    const kataS = new Set(kataLabel(s));
    const kuat = entri.filter((e) => e.kata.filter((w) => kataS.has(w)).length / e.kata.length >= 0.6);
    const lemah = entri.filter((e) => e.kata.some((w) => khas(w) && kataS.has(w)));
    const acuan = kuat.length ? kuat : dibahasJawaban;
    if (!acuan.length) continue;
    const sah = new Set([...nilaiDari(acuan), ...nilaiDari(lemah)]);
    const salah = ada.filter((k) => !sah.has(k));
    if (salah.length) {
      return `nilai kolom "${salah.join('", "')}" bertentangan dengan blok TABEL CENTANG (baris yang dibahas bernilai ${[...nilaiDari(acuan)].join(', ')} menurut posisi tanda di PDF)`;
    }
  }
  const disebut = kalimat.some((s) => { const ada = kolom.filter((k) => menyebut(s, k)); return ada.length > 0 && !(kolom.length >= 2 && ada.length === kolom.length); });
  if (!disebut) return null;
  if (adaTidakPasti) {
    const hal = halamanTidakPasti.length ? ` halaman ${halamanTidakPasti.join(', ')}` : '';
    return `potongan sumber memuat penanda TABEL CENTANG TIDAK PASTI${hal} — kolom tanda centang di sana tidak bisa dipastikan`;
  }
  return null;
}

export type HasilLabel ={ jawaban: string; dikoreksi: boolean; alasan: string; catatan: string; label: string };

export function periksaLabelSumber(jawaban: string, judulDokumen: string[], isiDokumen: string[] = []): HasilLabel {
  const teks = String(jawaban || '').replace(/\[\s*status\s*:\s*verified\s*\]/gi, LABEL_VERIFIED);
  const diam: HasilLabel = { jawaban: teks, dikoreksi: false, alasan: '', catatan: '', label: '' };
  const judul = (judulDokumen || []).filter((j) => typeof j === 'string' && j.trim());
  const tampil = teks.replace(/<think>[\s\S]*?<\/think>/gi, '');

  const adaLabel = /\[\s*status\s*:/i.test(tampil) || tampil.includes('[Pengetahuan umum AI');
  if (!adaLabel) {
    if (!judul.length) return diam;
    return { jawaban: `${teks.trimEnd()}\n\n${LABEL_HIPOTESIS}`, dikoreksi: true, alasan: 'model tidak menulis label status', catatan: CATATAN_TANPA_LABEL, label: LABEL_HIPOTESIS };
  }

  if (!tampil.includes(LABEL_VERIFIED)) return diam;
  const turunkan = (alasan: string, catatan: string): HasilLabel => ({
    jawaban: teks.split(LABEL_VERIFIED).join(LABEL_HIPOTESIS), dikoreksi: true, alasan, catatan, label: LABEL_HIPOTESIS
  });
  const JANGKAUAN = 300;
  const kutipan: string[] = [];
  const pola = /sumber/gi;
  let temu: RegExpExecArray | null;
  while ((temu = pola.exec(tampil)) !== null) kutipan.push(tampil.slice(temu.index, temu.index + JANGKAUAN));
  const isiRapi = (isiDokumen || []).filter((t) => typeof t === 'string' && t.trim()).map(rapikan);
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

  const LAPISAN_KLAIM_AKTIF = false;
  if (!LAPISAN_KLAIM_AKTIF) return diam;
  const putusan = putuskanKlaim(tampil, isiDokumen);
  if (putusan.putusan === 'diam') return diam;

  const sorot = ringkasTakBersandar(putusan.takBersandar);
  if (putusan.putusan === 'hipotesis') {
    return turunkan(putusan.alasan, `_Catatan sistem: label VERIFIED diturunkan — ${putusan.alasan}. Periksa langsung di dokumen: ${sorot}._`);
  }
  return {
    jawaban: teks.split(LABEL_VERIFIED).join(LABEL_PARSIAL),
    dikoreksi: true,
    alasan: putusan.alasan,
    catatan: `_Catatan sistem: label VERIFIED diturunkan menjadi PARTIAL — ${putusan.alasan}. Yang belum ditemukan sandarannya: ${sorot}. Bagian selebihnya tetap bersandar pada dokumen._`,
    label: LABEL_PARSIAL
  };
}

export function koreksiLabel(jawaban: string, judulDokumen: string[], mode: string, isiDokumen: string[] = []): string {
  const hasil = periksaLabelSumber(jawaban, judulDokumen, isiDokumen);
  if (hasil.dikoreksi) {
    console.warn(`[LABEL] ${mode}: VERIFIED -> HYPOTHESIS (${hasil.alasan}); dokumen dilampirkan: ${judulDokumen?.length ?? 0}`);
    return `${hasil.jawaban}\n\n${hasil.catatan}`;
  }
  return hasil.jawaban;
}
