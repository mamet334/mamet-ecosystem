import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { RuntimeContext } from '../runtime_context.ts';
import { MODEL_TULIS_ULANG } from '../rag/query_rewrite.ts';
import { LABEL_VERIFIED, LABEL_HIPOTESIS } from '../verification/label_sumber.ts';
import {
  normalkanRencana, saringPegawai, susunTeksUntukModel, susunLampiran, uraiRencana, susunJudulHasil,
  samarkanNipKarangan, KELOMPOK, BIDANG, OPERATOR, KELOMPOKKAN,
} from '../../../../../shared/dataTabelAsnSaring.js';

export function tutupJawabanDataTabel(jawaban: string, dt: { status: string; judul: string; lampiran: string }): { teks: string; nipDisamarkan: number } {
  let teks = String(jawaban || '');
  const akhirNalar = teks.trimStart().startsWith('<think>') ? teks.indexOf('</think>') : -1;
  const nalar = akhirNalar >= 0 ? teks.slice(0, akhirNalar + '</think>'.length) : '';
  let isi = akhirNalar >= 0 ? teks.slice(akhirNalar + '</think>'.length) : teks;
  const samar = samarkanNipKarangan(isi);
  isi = samar.teks;
  if (dt.status === 'gagal') isi = isi.split(LABEL_VERIFIED).join(LABEL_HIPOTESIS);
  const kepala = dt.judul ? `${dt.judul}\n\n` : '';
  teks = `${nalar}${nalar ? '\n\n' : ''}${kepala}${isi.trim()}${dt.lampiran ? `\n${dt.lampiran}` : ''}`;
  return { teks, nipDisamarkan: samar.jumlah };
}


export const JUDUL_DATA_TABEL = 'Data Tabel Rekonsiliasi ASN';
const HALAMAN = 1000;

const SISTEM_PERENCANA = `Anda mengubah pertanyaan pengguna tentang DATA PEGAWAI ASN (hasil rekonsiliasi per OPD) menjadi RENCANA saringan JSON.
Keluarkan HANYA satu objek JSON, tanpa teks lain, dengan bentuk:
{"relevan": true|false, "opd": [..], "kelompok": [..], "syarat": [{"bidang": "..", "operator": "..", "nilai": ".."}], "keluaran": "hitung"|"daftar", "kelompokkan": null|".."}

Aturan:
- relevan=false bila pertanyaan BUKAN tentang data pegawai yang tersimpan (mis. isi peraturan, standar kompetensi jabatan, pengetahuan umum).
- opd: pilih dari DAFTAR OPD persis seperti tertulis; [] = semua OPD.
- kelompok: ${KELOMPOK.join(', ')}. "pejabat struktural"/"jabatan struktural" = struktural; "fungsional"/"JFT" = jft; "pelaksana"/"JFU" = pelaksana; "PPPK paruh waktu" = paruh_waktu. [] = semua.
- bidang: ${Object.entries(BIDANG).map(([k, v]) => `${k} (${v})`).join('; ')}.
- operator: ${OPERATOR.join(', ')}. "belum ikut/belum mengikuti X" = kosong (bila X = PIM → bidang pim; bila pelatihan/diklat teknis/fungsional umum → bidang pelatihan); pelatihan tertentu → pelatihan mengandung "kata kunci"; "PIM IV" → pim mengandung "IV".
- keluaran: "hitung" untuk "berapa"; "daftar" untuk "siapa saja", "sebutkan", "daftar".
- kelompokkan (opsional, untuk "per ..."): ${KELOMPOKKAN.join(', ')}.
Contoh: "berapa pejabat struktural di RSUD yang belum ikut PIM?" → {"relevan":true,"opd":["RSUD"],"kelompok":["struktural"],"syarat":[{"bidang":"pim","operator":"kosong"}],"keluaran":"hitung","kelompokkan":null}`;

type Pegawai = Record<string, any>;

async function ambilPegawaiAktif(userId: string, rctx: RuntimeContext): Promise<{ pegawai: Pegawai[]; daftarOpd: string[] }> {
  const sb = createClient(rctx.env.supabaseUrl, rctx.env.supabaseServiceKey);
  const { data: berkas, error } = await sb.from('asn_berkas').select('id, opd').eq('user_id', userId).is('digantikan_oleh', null);
  if (error) throw new Error(`asn_berkas: ${error.message}`);
  if (!berkas?.length) return { pegawai: [], daftarOpd: [] };
  const opdMenurutBerkas = new Map(berkas.map((b: any) => [b.id, b.opd]));
  const pegawai: Pegawai[] = [];
  for (let dari = 0; ; dari += HALAMAN) {
    const { data, error: e } = await sb.from('asn_pegawai')
      .select('berkas_id, sheet, kelompok, baris_asal, nama, nip, jenis_kelamin, status, pendidikan_cpns, pendidikan_akhir, tahun_lulus, jabatan, pangkat, pim, pelatihan, nilai_ipa')
      .eq('user_id', userId).in('berkas_id', [...opdMenurutBerkas.keys()])
      .order('id').range(dari, dari + HALAMAN - 1);
    if (e) throw new Error(`asn_pegawai: ${e.message}`);
    for (const p of data || []) pegawai.push({ ...p, opd: opdMenurutBerkas.get(p.berkas_id) });
    if (!data || data.length < HALAMAN) break;
  }
  return { pegawai, daftarOpd: [...new Set(berkas.map((b: any) => b.opd))] };
}

async function rencanakan(pesan: string, daftarOpd: string[], rctx: RuntimeContext): Promise<{ mentah: any; ms: number; biaya?: number; percobaan: number } | null> {
  const kunci = (rctx?.keys?.openRouterByok || '').trim();
  if (!kunci) return null;
  const t0 = Date.now();
  let biaya = 0;
  for (let percobaan = 1; percobaan <= 2; percobaan++) {
    const pengendali = new AbortController();
    const penghenti = setTimeout(() => pengendali.abort(), 8000);
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST', signal: pengendali.signal,
        headers: { 'Authorization': `Bearer ${kunci}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL_TULIS_ULANG, max_tokens: 1000, temperature: 0, reasoning: { enabled: false },
          messages: [
            { role: 'system', content: SISTEM_PERENCANA },
            { role: 'user', content: `DAFTAR OPD: ${daftarOpd.map((o) => `"${o}"`).join(', ')}\n\nPERTANYAAN: ${pesan.slice(0, 1500)}\n\nKeluarkan HANYA objek JSON satu baris.` },
          ],
        }),
      });
      if (!res.ok) { console.warn(`[DataTabel] Perencana gagal (percobaan ${percobaan}): OpenRouter ${res.status}`); continue; }
      const body = await res.json().catch(() => ({}));
      biaya += Number(body?.usage?.cost || 0);
      const teks = String(body?.choices?.[0]?.message?.content || '');
      const awal = teks.indexOf('{'), akhir = teks.lastIndexOf('}');
      if (awal < 0 || akhir <= awal) {
        console.warn(`[DataTabel] Perencana: JSON tidak utuh (percobaan ${percobaan}, ${teks.length} huruf, finish=${body?.choices?.[0]?.finish_reason})`);
        continue;
      }
      return { mentah: JSON.parse(teks.slice(awal, akhir + 1)), ms: Date.now() - t0, biaya, percobaan };
    } catch (e: any) {
      console.warn(`[DataTabel] Perencana gagal (percobaan ${percobaan}): ${e?.name === 'AbortError' ? 'melebihi batas waktu' : e?.message}`);
    } finally {
      clearTimeout(penghenti);
    }
  }
  return null;
}

export type HasilDataTabel = {
  status: 'ok' | 'gagal' | 'lewat';
  dokumen: { title: string; content: string; source_type: string; similarity: number } | null;
  judul: string; lampiran: string; langkah: string;
};

export async function jalankanDataTabel(pesan: string, userId: string, rctx: RuntimeContext): Promise<HasilDataTabel> {
  const dok = (isi: string) => ({ title: JUDUL_DATA_TABEL, content: `[Dari file "${JUDUL_DATA_TABEL}"]\n${isi}`, source_type: 'local', similarity: 1 });
  const gagal = (alasan: string, langkah: string): HasilDataTabel => ({
    status: 'gagal',
    dokumen: dok(`DATA TABEL TIDAK DIHITUNG: ${alasan}. Sampaikan ini apa adanya. JANGAN menulis angka, tabel, atau nama pegawai apa pun.`),
    judul: `⚠️ **Data tabel tidak dihitung** — ${alasan}. Angka apa pun di bawah BUKAN hasil hitung sistem.`,
    lampiran: '', langkah,
  });
  try {
    const { pegawai, daftarOpd } = await ambilPegawaiAktif(userId, rctx);
    if (!pegawai.length) return gagal('belum ada data tabel tersimpan (unggah Excel di Research App lalu Simpan)', '📊 [DATA TABEL] belum ada data tersimpan');
    const r = await rencanakan(pesan, daftarOpd, rctx);
    if (!r) return gagal('pertanyaan gagal diterjemahkan menjadi saringan — silakan ulangi', '📊 [DATA TABEL] perencana gagal (2 percobaan)');
    const rencana = normalkanRencana(r.mentah, daftarOpd);
    if (!rencana.relevan) {
      console.log(`[DataTabel] Tidak relevan menurut perencana (${r.ms} ms) — jawaban dari jalur biasa.`);
      return { status: 'lewat', dokumen: null, judul: '', lampiran: '', langkah: `📊 [DATA TABEL] pertanyaan bukan tentang data pegawai — dilewati (${r.ms} ms)` };
    }
    const hasil = saringPegawai(pegawai, rencana);
    const lampiran = hasil.jumlah && (rencana.keluaran === 'daftar' || hasil.jumlah <= 200) ? susunLampiran(hasil, rencana) : '';
    const langkah = `📊 [DATA TABEL] ${uraiRencana(rencana)} → ${hasil.jumlah} dari ${hasil.dari} orang (perencana ${r.ms} ms, percobaan ${r.percobaan}, $${r.biaya || '?'})${rencana.diabaikan.length ? ` · diabaikan: ${rencana.diabaikan.join('; ')}` : ''}`;
    console.log(`[DataTabel] ${langkah}`);
    let judul = susunJudulHasil(hasil, rencana);
    if (rencana.diabaikan.length) judul += `\n_Tidak bisa diterapkan: ${rencana.diabaikan.join('; ')}._`;
    return { status: 'ok', dokumen: dok(susunTeksUntukModel(hasil, rencana)), judul, lampiran, langkah };
  } catch (e: any) {
    console.error(`[DataTabel] Gagal: ${e?.message}`);
    return gagal(`data gagal dibaca (${e?.message})`, `📊 [DATA TABEL] gagal: ${e?.message}`);
  }
}
