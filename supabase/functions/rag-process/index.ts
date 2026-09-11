import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { chunkText, embedLewatOpenRouter, EmbedGagal } from '../agent-process/lib/vector_utils.ts'

/**
 * rag-process — memotong dokumen, memvektorkan, dan menyimpannya ke RAG.
 *
 * DITULIS ULANG 2026-09-10 (Item 64), setelah uji unggah HCDP di Item 63 gagal:
 *  - Embedding lewat OpenRouter dengan KUNCI PENGGUNA (header x-byok-openrouter),
 *    bukan kunci Gemini sistem. Tanpa kunci → ditolak dengan pesan jelas.
 *  - Potongan dikirim BERKELOMPOK, bukan satu per satu dengan jeda 0,6 detik. Dulu
 *    33 potongan gagal setelah 44 detik; berkelompok selesai ±3,4 detik.
 *  - Anggaran waktu dijaga di bawah batas wall-clock edge function (150 s). Dihentikan
 *    platform di tengah jalan berarti blok `catch` tak sempat membatalkan, dan dokumen
 *    setengah jadi tertinggal di RAG.
 *  - Identitas pengguna diambil dari TOKEN SESI. Fungsi ini di-deploy verify_jwt=false
 *    dan memakai service role; dulu `userId` dari body dipercaya begitu saja, sehingga
 *    siapa pun bisa menulis dokumen ke akun orang lain. `spaceId` kiriman klien juga
 *    wajib milik pengguna itu.
 *  - Berkas PDF/Word yang dibaca mentah (mametlite memanggil file.text() untuk .pdf dan
 *    .docx) ditolak — kalau tidak, pengguna membayar untuk memvektorkan sampah biner.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-byok-openrouter',
};

const UKURAN_KELOMPOK = 12;
const ANGGARAN_WAKTU_MS = 110_000;

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
  const pengganti = sampel.split('\uFFFD').length - 1;
  return sampel.length > 0 && pengganti / sampel.length > 0.01;
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
  let tersimpan = 0;
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

    const { title, text, userId: userIdBody, spaceId, source_url, source_type, retrieved_at } = await req.json();
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

    // 5. Potong teks.
    const chunks = chunkText(text, 4500).filter(c => c.trim() !== '');
    totalPotongan = chunks.length;
    if (chunks.length === 0) {
      return jawab({ error: `Dokumen "${title}" kosong atau tidak memiliki teks yang bisa dibaca.`, code: 'EMPTY_DOCUMENT' }, 400);
    }

    // 6. Dokumen induk.
    const docPayload: Record<string, unknown> = { title, user_id: userId, space_id: targetSpaceId };
    if (source_url !== undefined) docPayload.source_url = source_url;
    if (source_type !== undefined) docPayload.source_type = source_type;
    if (retrieved_at !== undefined) docPayload.retrieved_at = retrieved_at;

    const { data: docData, error: docError } = await supabase
      .from('documents').insert(docPayload).select('id').single();
    if (docError) throw new Error(`DB Error: ${docError.message}`);
    documentId = docData.id;

    console.log(`[rag-process] ${chunks.length} potongan untuk "${title}" (user ${userId}), kelompok ${UKURAN_KELOMPOK}`);

    // 7. Vektorkan berkelompok, simpan per kelompok.
    for (let i = 0; i < chunks.length; i += UKURAN_KELOMPOK) {
      const sisa = ANGGARAN_WAKTU_MS - (Date.now() - mulai);
      if (sisa <= 0) {
        throw new EmbedGagal(
          'WAKTU_HABIS',
          `Dokumen terlalu besar untuk sekali proses. Pecah dokumen (misalnya per bab) lalu unggah bagian demi bagian.`,
          413
        );
      }
      const kelompok = chunks.slice(i, i + UKURAN_KELOMPOK);
      const vektor = await embedLewatOpenRouter(kelompok, kunci, { batasWaktuMs: sisa });

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
    console.log(`[rag-process] ✅ "${title}": ${tersimpan}/${chunks.length} potongan dalam ${detik} s`);
    return jawab({
      success: true,
      message: `Berhasil memproses ${tersimpan} dari ${chunks.length} blok teks.`,
      documentId,
      chunks: tersimpan,
      seconds: detik
    }, 200);

  } catch (error: any) {
    // Batalkan dokumen setengah jadi — potongannya ikut terhapus (ON DELETE CASCADE).
    if (documentId) {
      const { error: hapusError } = await supabase.from('documents').delete().eq('id', documentId);
      if (hapusError) console.error(`[rag-process] Gagal membatalkan dokumen ${documentId}: ${hapusError.message}`);
    }
    const status = error instanceof EmbedGagal ? error.status : 500;
    const code = error instanceof EmbedGagal ? error.kode : 'INTERNAL';
    const pesan = totalPotongan > 0
      ? `Proses terhenti setelah ${tersimpan} dari ${totalPotongan} potongan — dokumen dibatalkan. ${error.message}`
      : error.message;
    console.error(`[rag-process] ❌ ${code} setelah ${((Date.now() - mulai) / 1000).toFixed(1)} s: ${pesan}`);
    return jawab({ error: pesan, code }, status);
  }
});
