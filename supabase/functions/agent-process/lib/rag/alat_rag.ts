import { argumenRagAman, adalahUuid, BATAS_BACA_HURUF } from '../../../../../shared/ragAlat.js';

export interface DependensiAlatRag {
  db: any;
  userId: string;
  spaceTerkunci: string | null;
  ambang: number;
  vektorKueri: (kueri: string) => Promise<{ vektor: number[]; sebab?: string }>;
  cariMakna: (vektor: number[], kueri: string, spaceId: string | null, jumlah: number) => Promise<any[]>;
}

export const TANPA_SPACE_ENGINEER = 'TANPA_SPACE_ENGINEER';
const BARIS_BACA_PER_KUERI = 200;

const lolosIlike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

async function spacesAktif(d: DependensiAlatRag) {
  const { data, error } = await d.db.from('knowledge_spaces').select('id, name, archived, created_at').eq('user_id', d.userId).order('created_at', { ascending: true });
  if (error) throw new Error(`daftar space gagal dibaca: ${error.message}`);
  const aktif = (data || []).filter((s: any) => !s.archived);
  if (d.spaceTerkunci === TANPA_SPACE_ENGINEER) throw new Error('belum ada space "Pengetahuan Engineer" — Engineer hanya membaca space itu; buat space bernama "Pengetahuan Engineer" di Research App');
  return d.spaceTerkunci ? aktif.filter((s: any) => s.id === d.spaceTerkunci) : aktif;
}

function pilihSpace(daftar: any[], permintaan: string | undefined, d: DependensiAlatRag) {
  if (!permintaan) return null;
  const q = permintaan.trim().toLowerCase();
  const persis = daftar.filter((s) => s.id === permintaan.trim() || String(s.name || '').trim().toLowerCase() === q);
  const cocok = persis.length ? persis : daftar.filter((s) => String(s.name || '').toLowerCase().includes(q));
  if (cocok.length === 1) return cocok[0];
  if (!cocok.length) {
    throw new Error(d.spaceTerkunci
      ? `space "${permintaan}" tidak tersedia — Engineer hanya membaca space "Pengetahuan Engineer"`
      : `space "${permintaan}" tidak ditemukan. Space yang ada: ${daftar.map((s) => s.name).join(', ') || '(tidak ada)'}`);
  }
  throw new Error(`"${permintaan}" cocok dengan ${cocok.length} space (${cocok.map((s) => s.name).join(', ')}) — sebutkan nama persis atau id`);
}

async function cariDokumen(d: DependensiAlatRag, spaces: any[], acuan: string) {
  const idSpace = spaces.map((s) => s.id);
  if (!idSpace.length) throw new Error('tidak ada space aktif');
  let q = d.db.from('documents').select('id, title, space_id, created_at, total_potongan').eq('user_id', d.userId).eq('selesai', true).in('space_id', idSpace);
  q = adalahUuid(acuan) ? q.eq('id', acuan.trim()) : q.ilike('title', lolosIlike(acuan.trim()));
  const { data, error } = await q.limit(20);
  if (error) throw new Error(`dokumen gagal dicari: ${error.message}`);
  const daftar = data || [];
  if (daftar.length === 1) return daftar[0];
  if (!daftar.length) throw new Error(`dokumen "${acuan}" tidak ditemukan (judul harus persis, atau pakai id dari rag_daftar)`);
  throw new Error(`ada ${daftar.length} dokumen berjudul "${acuan}" — pilih id: ${daftar.map((x: any) => `${x.id} (diunggah ${String(x.created_at).slice(0, 10)})`).join(', ')}`);
}

const namaSpace = (spaces: any[], id: string) => spaces.find((s) => s.id === id)?.name ?? '?';

async function daftar(p: any, d: DependensiAlatRag) {
  const spaces = await spacesAktif(d);
  const dipilih = pilihSpace(spaces, p.space, d);
  const sasaran = dipilih ? [dipilih] : spaces;
  const hitung = await Promise.all(spaces.map(async (s) => {
    const { count, error } = await d.db.from('documents').select('id', { count: 'exact', head: true }).eq('user_id', d.userId).eq('selesai', true).eq('space_id', s.id);
    if (error) throw new Error(`jumlah dokumen space "${s.name}" gagal dihitung: ${error.message}`);
    return { nama: s.name, dokumen: count ?? 0, dipilih: dipilih?.id === s.id };
  }));
  if (!sasaran.length) return { ok: true, alat: p.alat, urut: p.urut, dari: p.dari, total: 0, spaces: hitung, dokumen: [], space: p.space, cari: p.cari };
  let q = d.db.from('documents').select('id, title, space_id, created_at, total_potongan', { count: 'exact' })
    .eq('user_id', d.userId).eq('selesai', true).in('space_id', sasaran.map((s) => s.id));
  if (p.cari) q = q.ilike('title', `%${lolosIlike(p.cari)}%`);
  q = p.urut === 'judul' ? q.order('title', { ascending: true }) : q.order('created_at', { ascending: p.urut === 'terlama' });
  const { data, count, error } = await q.order('id', { ascending: true }).range(p.dari - 1, p.dari - 1 + p.jumlah - 1);
  if (error) throw new Error(`daftar dokumen gagal dibaca: ${error.message}`);
  return {
    ok: true, alat: p.alat, urut: p.urut, dari: p.dari, total: count ?? (data || []).length, spaces: hitung, space: p.space, cari: p.cari,
    dokumen: (data || []).map((x: any) => ({ id: x.id, judul: x.title, space: namaSpace(spaces, x.space_id), dibuat: x.created_at, potongan: x.total_potongan })),
  };
}

async function cari(p: any, d: DependensiAlatRag) {
  const spaces = await spacesAktif(d);
  const dipilih = pilihSpace(spaces, p.space, d);
  const dok = p.dokumen ? await cariDokumen(d, dipilih ? [dipilih] : spaces, p.dokumen) : null;
  const { vektor, sebab } = await d.vektorKueri(p.kueri);
  if (!vektor.length) throw new Error(`vektor kueri tidak bisa dibuat (${sebab || 'tanpa keterangan'}) — rag_daftar dan rag_baca tetap bisa dipakai`);
  let temuan: any[];
  if (dok) {
    const { data, error } = await d.db.rpc('cari_potongan_dokumen', { query_embedding: vektor, p_user_id: d.userId, p_document_id: dok.id, match_count: p.jumlah });
    if (error) throw new Error(`pencarian di dalam dokumen gagal: ${error.message}`);
    temuan = (data || []).map((r: any) => ({ judul: r.title, dokumenId: r.document_id, urutan: r.urutan, skor: r.similarity, isi: r.content }));
  } else {
    const spaceCari = dipilih?.id ?? d.spaceTerkunci ?? null;
    const hasil = await d.cariMakna(vektor, p.kueri, spaceCari, p.jumlah);
    const idPotongan = hasil.map((r: any) => r.id).filter(Boolean);
    const urutan = new Map<string, number | null>();
    if (idPotongan.length) {
      const { data, error } = await d.db.from('document_chunks').select('id, urutan').in('id', idPotongan);
      if (error) throw new Error(`nomor urut potongan gagal dibaca: ${error.message}`);
      for (const r of data || []) urutan.set(r.id, r.urutan);
    }
    temuan = hasil.slice(0, p.jumlah).map((r: any) => ({ judul: r.title, dokumenId: r.document_id, urutan: urutan.get(r.id) ?? null, skor: r.similarity, isi: r.raw_content ?? r.content }));
  }
  return { ok: true, alat: p.alat, kueri: p.kueri, space: p.space, dokumen: p.dokumen, jumlah: p.jumlah, ambang: d.ambang, temuan };
}

async function baca(p: any, d: DependensiAlatRag) {
  const spaces = await spacesAktif(d);
  const dok = await cariDokumen(d, spaces, p.dokumen);
  const { count: total, error: errTotal } = await d.db.from('document_chunks').select('id', { count: 'exact', head: true }).eq('document_id', dok.id);
  if (errTotal || typeof total !== 'number') throw new Error(`jumlah potongan gagal dihitung: ${errTotal?.message || 'kosong'}`);
  const { count: tanpaUrutan, error: errUrutan } = await d.db.from('document_chunks').select('id', { count: 'exact', head: true }).eq('document_id', dok.id).is('urutan', null);
  if (errUrutan || typeof tanpaUrutan !== 'number') throw new Error(`nomor urut potongan gagal diperiksa: ${errUrutan?.message || 'kosong'}`);
  const berurutan = tanpaUrutan === 0;
  const akhirDiminta = Math.min(p.sampai ?? total, total);
  const potongan: { nomor: number; isi: string }[] = [];
  let huruf = 0;
  let terpotong = false;
  let posisi = p.dari;
  while (posisi <= akhirDiminta && !terpotong) {
    const mulai = posisi;
    const sampai = Math.min(akhirDiminta, mulai + BARIS_BACA_PER_KUERI - 1);
    let q = d.db.from('document_chunks').select('id, urutan, content').eq('document_id', dok.id);
    q = berurutan ? q.gte('urutan', mulai).lte('urutan', sampai).order('urutan', { ascending: true }) : q.order('id', { ascending: true }).range(mulai - 1, sampai - 1);
    const { data, error } = await q;
    if (error) throw new Error(`potongan gagal dibaca: ${error.message}`);
    const baris = data || [];
    if (!baris.length) break;
    for (const r of baris) {
      const isi = String(r.content ?? '');
      if (potongan.length && huruf + isi.length > BATAS_BACA_HURUF) { terpotong = true; break; }
      const nomor = berurutan ? r.urutan : posisi;
      potongan.push({ nomor, isi });
      huruf += isi.length;
      posisi = nomor + 1;
    }
    if (baris.length < sampai - mulai + 1) break;
  }
  return { ok: true, alat: p.alat, dokumen: p.dokumen, dokumenId: dok.id, judul: dok.title, space: namaSpace(spaces, dok.space_id), total, dari: p.dari, berurutan, terpotong, potongan };
}

export async function jalankanAlatRag(mentah: any, d: DependensiAlatRag) {
  const { permintaan: p, galat } = argumenRagAman(mentah);
  if (!p) return { ok: false, alat: mentah?.alat, alasan: galat };
  try {
    if (p.alat === 'rag_daftar') return await daftar(p, d);
    if (p.alat === 'rag_cari') return await cari(p, d);
    return await baca(p, d);
  } catch (e: any) {
    return { ok: false, alat: p.alat, kueri: p.kueri, dokumen: p.dokumen, space: p.space, alasan: String(e?.message || e) };
  }
}
