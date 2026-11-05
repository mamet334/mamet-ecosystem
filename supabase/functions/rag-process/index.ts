import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { chunkText, embedLewatOpenRouter, EmbedGagal } from '../agent-process/lib/vector_utils.ts'
import { tolakKarenaVolume } from './batas_volume.ts'

/**
 * rag-process — memotong dokumen, memvektorkan, dan menyimpannya ke RAG.
 *
 * DITULIS ULANG 2026-09-10 (Item 64), setelah uji unggah HCDP di Item 63 gagal:
 *  - Embedding lewat OpenRouter dengan KUNCI PENGGUNA (header x-byok-openrouter),
 *    bukan kunci Gemini sistem. Tanpa kunci → ditolak dengan pesan jelas.
 *  - Potongan dikirim BERKELOMPOK, bukan satu per satu dengan jeda 0,6 detik. Dulu
 *    33 potongan gagal setelah 44 detik; berkelompok selesai ±3,4 detik.
 *  - Identitas pengguna diambil dari TOKEN SESI. Fungsi ini di-deploy verify_jwt=false
 *    dan memakai service role; dulu `userId` dari body dipercaya begitu saja, sehingga
 *    siapa pun bisa menulis dokumen ke akun orang lain. `spaceId` kiriman klien juga
 *    wajib milik pengguna itu.
 *  - Berkas PDF/Word yang dibaca mentah (mametlite memanggil file.text() untuk .pdf dan
 *    .docx) ditolak — kalau tidak, pengguna membayar untuk memvektorkan sampah biner.
 *
 * UNGGAH BERTAHAP (K1 langkah 2, 2026-11-05 — keputusan Owner: satu berkas mentah = satu dokumen; yang gagal di tengah
 * jalan menjadi cache, dilanjutkan dengan berkas yang sama tanpa embedding ulang dari awal). 5 Nov buku umum Owner
 * berhenti di 1.856/1.986 potongan sesudah 105 detik dan SELURUHNYA dibuang — embedding 58 kelompok tetap dibayar.
 *  - Dokumen dibuat `selesai = false`; setiap kelompok 32 potongan disimpan begitu vektornya jadi. Pencarian chat
 *    hanya membaca dokumen `selesai` (migrasi 20261105000000), jadi buku setengah jadi tak pernah dipakai menjawab.
 *  - Satu panggilan bekerja ±80 detik lalu menjawab `selesai: false` + jumlah tersimpan; klien memanggil lagi dengan
 *    teks yang sama. Titik lanjut dihitung SERVER dari potongan yang sudah tersimpan, bukan dipercaya dari klien.
 *  - Teks yang sama dikenali dari SHA-256-nya (dihitung di sini). Potongan ke-N hanya bermakna untuk teks dan aturan
 *    pemotongan yang sama — sidik atau jumlah potongan berbeda → ditolak dengan pesan, bukan disambung acak.
 *  - Gagal di tengah (penolakan penyedia, galat simpan) → dokumen DIPERTAHANKAN sebagai cache, kecuali belum satu pun
 *    potongan tersimpan. Penghapusan dokumen tertunda diputuskan pengguna (dari daftar dokumen), bukan otomatis.
 *  - Karakter NUL dibuang sebelum dipotong: Postgres menolaknya ("unsupported Unicode escape sequence") — 5 Nov satu
 *    changelog ber-UTF-16 campuran gagal karenanya.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-byok-openrouter',
};

// 32 potongan per panggilan embedding (dulu 12, saat potongan 4.500 huruf). Potongan kini 800 huruf (Item 70).
const UKURAN_KELOMPOK = 32;
// Kelompok baru tidak dimulai lewat 80 detik; satu kelompok yang sedang berjalan masih boleh selesai sampai 110 detik
// (batas wall-clock edge function 150 s — dihentikan platform berarti tak sempat menjawab).
export const ANGGARAN_PANGGILAN_MS = 80_000;
const BATAS_KERAS_MS = 110_000;
// Kunci sementara per dokumen (migrasi 20261105010000): di atas batas keras, supaya panggilan yang masih berjalan tak
// pernah kehilangan kuncinya; kunci yang tak sempat dilepas (fungsi dihentikan platform) kedaluwarsa sendiri.
export const SEWA_KUNCI_MS = 130_000;
const kunciSampai = () => new Date(Date.now() + SEWA_KUNCI_MS).toISOString();

function jawab(isi: unknown, status: number): Response {
  return new Response(JSON.stringify(isi), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// PDF mentah diawali "%PDF-", DOCX adalah arsip ZIP ("PK" + byte 0x03 0x04 — lengkap dengan
// dua byte kontrolnya, supaya teks biasa yang dibuka dengan "PKH ..." tidak ikut tertolak).
// Biner lain yang dibaca sebagai UTF-8 menghasilkan banyak karakter pengganti U+FFFD.
function tampakBiner(text: string): boolean {
  const awal = text.trimStart();
  if (awal.startsWith('%PDF-') || awal.startsWith('PK\u0003\u0004')) return true;
  const sampel = text.slice(0, 20_000);
  const pengganti = sampel.split('�').length - 1;
  return sampel.length > 0 && pengganti / sampel.length > 0.01;
}

export async function sidikTeks(teks: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(teks));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const mulai = Date.now();
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  let documentId: string | null = null;
  let versiLamaId: string | null = null;    // perbarui dokumen: versi selesai yang diganti versi ini
  let disalin = 0;                          // potongan yang vektornya disalin dari versi lama (panggilan ini)
  let memegangKunci = false;
  let dibuatSekarang = false;
  let sudahAda = 0;        // potongan yang tersimpan sebelum panggilan ini
  let sudahAdaDiketahui = true; // false selama hitungan potongan unggahan tertunda belum terbaca (5 Nov: timeout)
  let tersimpan = 0;       // potongan yang tersimpan di panggilan ini
  let totalPotongan = 0;

  try {
    // 1. Identitas dari token sesi — bukan dari body.
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: authData, error: authError } = token
      ? await supabase.auth.getUser(token)
      : { data: { user: null }, error: new Error('tanpa token') };
    const user = authData?.user;
    if (authError || !user) {
      return jawab({ error: 'Sesi tidak sah. Silakan masuk kembali.', code: 'UNAUTHORIZED' }, 401);
    }

    const { title, text, userId: userIdBody, spaceId, source_url, source_type, retrieved_at, perbarui } = await req.json();
    if (userIdBody && userIdBody !== user.id) {
      return jawab({ error: 'userId tidak cocok dengan sesi.', code: 'USER_MISMATCH' }, 403);
    }
    const userId = user.id;

    if (!title || !text) {
      return jawab({ error: 'Judul dan isi dokumen wajib ada.', code: 'MISSING_FIELDS' }, 400);
    }

    // 2. Kunci OpenRouter pengguna — pengguna membayar embedding-nya sendiri (Item 63).
    const kunci = (req.headers.get('x-byok-openrouter') ?? '').replace(/[^\x00-\x7F]/g, '').trim();
    if (!kunci) {
      return jawab({
        error: 'Unggah dokumen ke RAG memakai kunci OpenRouter Anda sendiri. Pasang kunci OpenRouter di Pengaturan, lalu coba lagi.',
        code: 'OPENROUTER_KEY_REQUIRED'
      }, 400);
    }

    // 3. Tolak berkas biner sebelum ada biaya. Sejak Item 69 aplikasi mengambil teks PDF/DOCX di
    //    browser, jadi yang sampai ke sini hanya dari aplikasi versi lama yang masih termuat.
    if (tampakBiner(text)) {
      return jawab({
        error: `"${title}" terkirim sebagai berkas PDF/Word mentah, bukan teks. Muat ulang aplikasi (versi lama belum bisa membaca PDF/Word), lalu unggah lagi.`,
        code: 'BINARY_FILE'
      }, 400);
    }

    // 4. Space: milik pengguna ini, atau space CORE-nya.
    let targetSpaceId: string | null = null;
    if (spaceId) {
      const { data: space } = await supabase
        .from('knowledge_spaces').select('id').eq('id', spaceId).eq('user_id', userId).maybeSingle();
      if (!space) {
        return jawab({ error: 'Ruang pengetahuan tidak ditemukan atau bukan milik Anda.', code: 'SPACE_NOT_OWNED' }, 403);
      }
      targetSpaceId = space.id;
    } else {
      const { data: core } = await supabase
        .from('knowledge_spaces').select('id').eq('user_id', userId).eq('space_type', 'CORE').maybeSingle();
      if (!core) {
        return jawab({ error: 'Core space belum di-setup untuk akun ini.', code: 'NO_CORE_SPACE' }, 400);
      }
      targetSpaceId = core.id;
    }

    // 5. Potong teks (NUL dibuang lebih dulu) dan hitung sidiknya.
    const bersih = String(text).replace(/\u0000/g, '');
    const chunks = chunkText(bersih).filter(c => c.trim() !== ''); // 800 / 100 — vector_utils (Item 70)
    totalPotongan = chunks.length;
    if (chunks.length === 0) {
      return jawab({ error: `Dokumen "${title}" kosong atau tidak memiliki teks yang bisa dibaca.`, code: 'EMPTY_DOCUMENT' }, 400);
    }
    const sidik = await sidikTeks(bersih);

    // 6. Unggahan tertunda dengan judul sama di ruang yang sama? Lanjutkan bila teksnya sama.
    const { data: tertunda, error: errTertunda } = await supabase
      .from('documents').select('id, sidik, total_potongan, menggantikan')
      .eq('user_id', userId).eq('title', title).eq('space_id', targetSpaceId).eq('selesai', false)
      .order('created_at', { ascending: false }).limit(1);
    if (errTertunda) throw new Error(`DB Error: ${errTertunda.message}`);
    const lama = Array.isArray(tertunda) ? tertunda[0] : null;
    if (lama) {
      if (lama.sidik !== sidik || lama.total_potongan !== chunks.length) {
        return jawab({
          error: `"${title}" punya unggahan yang belum selesai dengan isi berbeda (berkasnya berubah, atau hasil bacanya berbeda). ` +
            'Hapus dokumen yang belum selesai itu dari daftar, lalu unggah lagi.',
          code: 'TERTUNDA_BERBEDA'
        }, 409);
      }
      // Kunci sementara: panggilan lama (mis. sesudah Ctrl+R di aplikasi) mungkin masih menyimpan potongan. Dua panggilan
      // yang menghitung titik lanjut yang sama akan menyimpan potongan yang sama dua kali.
      const { data: terkunci, error: errKunci } = await supabase
        .from('documents').update({ diproses_sampai: kunciSampai() })
        .eq('id', lama.id).or(`diproses_sampai.is.null,diproses_sampai.lt.${new Date(Date.now()).toISOString()}`)
        .select('id');
      if (errKunci) throw new Error(`DB Error: ${errKunci.message}`);
      if (!Array.isArray(terkunci) || terkunci.length === 0) {
        return jawab({
          error: `"${title}" masih diproses oleh unggahan sebelumnya. Tunggu sebentar — unggahan dilanjutkan otomatis sesudah proses itu selesai.`,
          code: 'SEDANG_DIPROSES'
        }, 423);
      }
      documentId = lama.id;
      memegangKunci = true;
      versiLamaId = lama.menggantikan ?? null;   // versi baru yang belum selesai mengingat versi yang ia gantikan
      sudahAdaDiketahui = false;
      const { count, error: errHitung } = await supabase
        .from('document_chunks').select('id', { count: 'exact', head: true }).eq('document_id', documentId);
      if (errHitung || typeof count !== 'number') throw new Error(`DB Error: ${errHitung?.message || 'hitungan potongan kosong'}`);
      if (count > chunks.length) {
        return jawab({
          error: `"${title}" yang belum selesai menyimpan ${count} potongan, lebih banyak dari isi berkasnya (${chunks.length}). ` +
            'Hapus dokumen itu dari daftar, lalu unggah lagi.',
          code: 'TERTUNDA_TAK_KONSISTEN'
        }, 409);
      }
      sudahAda = count;
      sudahAdaDiketahui = true;
    } else if (perbarui === true) {
      // 6a. PERBARUI DOKUMEN (5 Nov 2026, permintaan Owner): versi selesai berjudul sama di ruang yang sama.
      const { data: versi, error: errVersi } = await supabase
        .from('documents').select('id, sidik, total_potongan')
        .eq('user_id', userId).eq('title', title).eq('space_id', targetSpaceId).eq('selesai', true)
        .order('created_at', { ascending: false }).limit(1);
      if (errVersi) throw new Error(`DB Error: ${errVersi.message}`);
      const v = Array.isArray(versi) ? versi[0] : null;
      if (v && v.sidik === sidik && v.total_potongan === chunks.length) {
        // Isi sama persis — tidak ada yang perlu dibangun, tidak ada biaya.
        return jawab({
          success: true, selesai: true, diperbarui: false, sama: true, documentId: v.id,
          message: `"${title}" isinya sama persis dengan yang tersimpan — tidak ada yang diperbarui.`,
          chunks: chunks.length, tersimpan: chunks.length, total: chunks.length
        }, 200);
      }
      versiLamaId = v?.id ?? null;
    }

    // 6b. Batas volume (K5, TM-004) — sebelum embedding: penolakan tanpa biaya. Hanya potongan yang BELUM tersimpan.
    //     Hitungan tak terbaca → DITOLAK dengan pesan jelas, bukan diloloskan diam-diam (K2: jujur saat gagal).
    const baru = chunks.length - sudahAda;
    if (baru > 0) {
      const [milik, semua] = await Promise.all([
        supabase.from('document_chunks').select('id, documents!inner(user_id)', { count: 'exact', head: true })
          .eq('documents.user_id', userId),
        supabase.from('document_chunks').select('id', { count: 'exact', head: true }),
      ]);
      if (milik.error || semua.error || typeof milik.count !== 'number' || typeof semua.count !== 'number') {
        console.error(`[rag-process] Hitungan volume gagal: ${milik.error?.message || semua.error?.message || 'count kosong'}`);
        return jawab({ error: 'Kapasitas penyimpanan dokumen tidak bisa diperiksa saat ini. Coba lagi sebentar lagi.', code: 'KUOTA_TAK_TERBACA' }, 503);
      }
      const tolakVolume = tolakKarenaVolume({ baru, milikAkun: milik.count, total: semua.count });
      if (tolakVolume) {
        console.warn(`[rag-process] ⛔ ${tolakVolume.code}: akun ${milik.count} + ${baru} baru, total ${semua.count}`);
        return jawab(tolakVolume, 413);
      }
    }

    // 7. Dokumen induk baru — belum selesai sampai potongan terakhir masuk.
    if (!documentId) {
      const docPayload: Record<string, unknown> = {
        title, user_id: userId, space_id: targetSpaceId, selesai: false, sidik, total_potongan: chunks.length,
        diproses_sampai: kunciSampai(),
        ...(versiLamaId ? { menggantikan: versiLamaId } : {})
      };
      if (source_url !== undefined) docPayload.source_url = source_url;
      if (source_type !== undefined) docPayload.source_type = source_type;
      if (retrieved_at !== undefined) docPayload.retrieved_at = retrieved_at;

      const { data: docData, error: docError } = await supabase
        .from('documents').insert(docPayload).select('id').single();
      if (docError) throw new Error(`DB Error: ${docError.message}`);
      documentId = docData.id;
      dibuatSekarang = true;
      memegangKunci = true;
    }

    console.log(`[rag-process] ${chunks.length} potongan untuk "${title}" (user ${userId}), ${sudahAda ? `lanjut dari ${sudahAda}, ` : ''}kelompok ${UKURAN_KELOMPOK}`);

    // 8. Vektorkan berkelompok, simpan per kelompok — setiap kelompok yang tersimpan adalah cache.
    for (let i = sudahAda; i < chunks.length; i += UKURAN_KELOMPOK) {
      if (Date.now() - mulai > ANGGARAN_PANGGILAN_MS) break;
      const kelompok = chunks.slice(i, i + UKURAN_KELOMPOK);

      if (versiLamaId) {
        // Perbarui dokumen: potongan yang isinya sama dengan versi lama menyalin vektornya (tanpa OpenRouter);
        // hanya sisanya di-embed. Satu kelompok disimpan dalam SATU perintah (atomik) — lihat migrasi 20261105030000.
        const { data: ada, error: errAda } = await supabase.rpc('potongan_lama_ada', { p_dok_baru: documentId, p_dok_lama: versiLamaId, p_isi: kelompok });
        if (errAda) throw new Error(`DB Error: ${errAda.message}`);
        const salin = new Set((Array.isArray(ada) ? ada : []).map((x: any) => Number(typeof x === 'object' ? Object.values(x)[0] : x) - 1));
        const perlu = kelompok.map((_, k) => k).filter((k) => !salin.has(k));
        const vektorBaru = perlu.length
          ? await embedLewatOpenRouter(perlu.map((k) => kelompok[k]), kunci, { batasWaktuMs: BATAS_KERAS_MS - (Date.now() - mulai) })
          : [];
        const pVektor: (string | null)[] = kelompok.map(() => null);
        perlu.forEach((k, j) => { pVektor[k] = JSON.stringify(vektorBaru[j]); });
        const { data: n, error: errSimpan } = await supabase.rpc('simpan_kelompok_perbarui', {
          p_dok_baru: documentId, p_dok_lama: versiLamaId, p_isi: kelompok, p_vektor: pVektor,
          p_source_url: source_url ?? null, p_source_type: source_type ?? null
        });
        if (errSimpan) throw new Error(`DB Insert Error: ${errSimpan.message}`);
        if (Number(n) !== kelompok.length) throw new Error(`DB Insert Error: tersimpan ${n} dari ${kelompok.length} potongan`);
        tersimpan += kelompok.length;
        disalin += salin.size;
        continue;
      }

      const vektor = await embedLewatOpenRouter(kelompok, kunci, { batasWaktuMs: BATAS_KERAS_MS - (Date.now() - mulai) });

      const baris = kelompok.map((content, k) => {
        const row: Record<string, unknown> = { document_id: documentId, content, embedding: vektor[k] };
        if (source_url !== undefined) row.source_url = source_url;
        if (source_type !== undefined) row.source_type = source_type;
        return row;
      });
      const { error: chunkError } = await supabase.from('document_chunks').insert(baris);
      if (chunkError) throw new Error(`DB Insert Error: ${chunkError.message}`);
      tersimpan += kelompok.length;
    }

    const detik = +((Date.now() - mulai) / 1000).toFixed(1);
    const kini = sudahAda + tersimpan;
    if (kini < chunks.length) {
      console.log(`[rag-process] ⏸ "${title}": ${kini}/${chunks.length} potongan (${tersimpan} di panggilan ini, ${detik} s) — dilanjutkan klien`);
      return jawab({
        success: true,
        selesai: false,
        message: `Tersimpan ${kini} dari ${chunks.length} blok teks — belum selesai; unggahan dilanjutkan dengan berkas yang sama.`,
        documentId, tersimpan: kini, total: chunks.length, seconds: detik
      }, 200);
    }

    const { error: errSelesai } = await supabase.from('documents').update({ selesai: true }).eq('id', documentId);
    if (errSelesai) throw new Error(`DB Error: ${errSelesai.message}`);
    // Perbarui dokumen: versi lama dihapus SESUDAH versi baru selesai (sesaat keduanya terbaca — lebih baik daripada
    // sesaat tak ada sama sekali). Gagal menghapus → dilaporkan; versi baru tetap sah.
    let catatanLama = '';
    if (versiLamaId) {
      const { data: terhapus, error: errHapusLama } = await supabase
        .from('documents').delete().eq('id', versiLamaId).eq('user_id', userId).select('id');
      if (errHapusLama || !Array.isArray(terhapus) || terhapus.length === 0) {
        console.error(`[rag-process] Versi lama ${versiLamaId} gagal dihapus: ${errHapusLama?.message || 'tidak ditemukan'}`);
        catatanLama = ' Versi lama gagal dihapus — hapus manual dari daftar.';
      } else {
        catatanLama = ' Versi lama diganti.';
      }
    }
    console.log(`[rag-process] ✅ "${title}": ${chunks.length}/${chunks.length} potongan${sudahAda ? ` (${sudahAda} dari cache)` : ''}${versiLamaId ? `, perbarui: ${disalin} vektor disalin dari versi lama` : ''} dalam ${detik} s`);
    return jawab({
      success: true,
      selesai: true,
      message: `Berhasil memproses ${chunks.length} dari ${chunks.length} blok teks${sudahAda ? ` (${sudahAda} sudah tersimpan sebelumnya)` : ''}${versiLamaId ? `; ${disalin} potongan tak berubah memakai vektor lama.` : '.'}${catatanLama}`,
      documentId, chunks: chunks.length, tersimpan: chunks.length, total: chunks.length, seconds: detik,
      ...(versiLamaId ? { diperbarui: true, disalin } : {})
    }, 200);

  } catch (error: any) {
    const kini = sudahAda + tersimpan;
    // Belum satu pun potongan tersimpan dan dokumennya baru dibuat → tak ada yang layak disimpan sebagai cache.
    const dibatalkan = Boolean(documentId) && dibuatSekarang && kini === 0;
    if (dibatalkan) {
      const { error: hapusError } = await supabase.from('documents').delete().eq('id', documentId);
      if (hapusError) console.error(`[rag-process] Gagal membatalkan dokumen ${documentId}: ${hapusError.message}`);
    }
    // Dokumen tertunda dari unggahan sebelumnya tetap ada walau panggilan ini belum menambah apa pun.
    const disimpan = Boolean(documentId) && !dibatalkan;
    const status = error instanceof EmbedGagal ? error.status : 500;
    const code = error instanceof EmbedGagal ? error.kode : 'INTERNAL';
    // Hitungan potongan unggahan tertunda gagal dibaca (5 Nov: statement timeout) → jangan menulis "0 dari N": yang
    // tersimpan sebelumnya tetap ada, hanya jumlahnya yang tak terbaca.
    const pesan = totalPotongan > 0
      ? (!sudahAdaDiketahui
        ? `Proses terhenti sebelum potongan baru disimpan — potongan dari unggahan sebelumnya tetap ada; unggah berkas yang sama lagi untuk melanjutkan. ${error.message}`
        : disimpan
          ? `Proses terhenti setelah ${kini} dari ${totalPotongan} potongan — yang sudah tersimpan DISIMPAN; unggah berkas yang sama lagi untuk melanjutkan. ${error.message}`
          : `Proses terhenti setelah 0 dari ${totalPotongan} potongan — dokumen dibatalkan. ${error.message}`)
      : error.message;
    console.error(`[rag-process] ❌ ${code} setelah ${((Date.now() - mulai) / 1000).toFixed(1)} s: ${pesan}`);
    return jawab({
      error: pesan, code,
      ...(totalPotongan > 0 ? { tersimpan: sudahAdaDiketahui ? kini : null, total: totalPotongan, bisaDilanjutkan: disimpan } : {}),
      ...(disimpan ? { documentId } : {})
    }, status);
  } finally {
    // Kunci dilepas di SETIAP jalan keluar (selesai, jeda anggaran, ditolak, gagal) — panggilan lanjutan klien tak perlu
    // menunggu kedaluwarsanya. Dokumen yang dibatalkan sudah terhapus; update ke baris yang tak ada tak berbuat apa-apa.
    if (memegangKunci && documentId) {
      const { error: errLepas } = await supabase.from('documents').update({ diproses_sampai: null }).eq('id', documentId);
      if (errLepas) console.error(`[rag-process] Kunci dokumen ${documentId} gagal dilepas (kedaluwarsa sendiri): ${errLepas.message}`);
    }
  }
});
