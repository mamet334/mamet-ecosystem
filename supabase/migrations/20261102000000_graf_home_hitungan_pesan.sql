-- Item 130 Tahap E (graf Home): percakapan berekor pesan — 2 Nov 2026.
--
-- Dua fungsi baca-saja untuk graf Home. Keduanya SECURITY INVOKER (RLS pemanggil tetap berlaku) DAN menyaring
-- `auth.uid()` sendiri; EXECUTE hanya untuk `authenticated` (Supabase memberi EXECUTE ke anon/public secara bawaan →
-- dicabut). Syarat Konstitusi 23 "FREE & SAFE": angka dihitung di basis data; isi konteks/memori tak pernah keluar.
--
-- 1. hitungan_graf_home(): angka saja —
--      'pesan'           per percakapan (ukuran simpul percakapan; dulu tetap 8)
--      'potongan'        per dokumen (dulu klien menarik ±3.600 baris document_id hanya untuk menghitung)
--      'pemakaian_model' total baris api_usage akun (panel "LLM CALLS" dulu menghitung kueri ber-limit 100 → selalu 100)
--    Biaya diukur 2 Nov: ±300 ms (membaca kolom messages 219 chat) sekali per buka Home — kuota komputasi, bukan tagihan.
--
-- 2. pesan_percakapan_graf(p_chat): ekor satu percakapan, dimuat SAAT DIKLIK. Per pesan: urutan, peran, cuplikan 80
--    huruf (nalar <think> dibuang), dan KODE alat yang dipakai — diturunkan dari angka/penanda, bukan dari isi:
--      toolsUsed[]                      nama alat (mis. deep_research, word_to_pdf)
--      subagentRuns[].subagent          nama sub-agent
--      [RAG CONTEXT GENERATED] ragArray size=N (termasuk M web/external chunks)
--                                       N − M > 0 → 'rag' ; M > 0 → 'web'
--      [MEMORY PROMPT GENERATED] … memoryArray size=K
--                                       K > 0 → 'memori' (teks memoryPrompt di baris itu TIDAK dikembalikan)
--    `[SYSTEM CONTEXT FINAL]` (teks dokumen) tidak disentuh.

create or replace function public.hitungan_graf_home()
returns table (jenis text, id uuid, jumlah integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select 'pesan'::text, c.id,
         coalesce(jsonb_array_length(case when jsonb_typeof(c.messages) = 'array' then c.messages end), 0)::integer
  from public.chats c
  where c.user_id = (select auth.uid())
  union all
  select 'potongan'::text, dc.document_id, count(*)::integer
  from public.document_chunks dc
  join public.documents d on d.id = dc.document_id
  where d.user_id = (select auth.uid())
  group by dc.document_id
  union all
  select 'pemakaian_model'::text, null::uuid, count(*)::integer
  from public.api_usage u
  where u.user_id = (select auth.uid());
$$;

create or replace function public.pesan_percakapan_graf(p_chat uuid)
returns table (urutan integer, peran text, cuplikan text, alat text[])
language sql
stable
security invoker
set search_path = ''
as $$
  select
    t.i::integer,
    coalesce(t.m->>'role', '-'),
    left(btrim(regexp_replace(regexp_replace(coalesce(t.m->>'content', ''), '<think>.*?</think>', '', 'g'), '\s+', ' ', 'g')), 80),
    array(
      select distinct a from (
        select jsonb_array_elements_text(case when jsonb_typeof(t.m->'metadata'->'toolsUsed') = 'array' then t.m->'metadata'->'toolsUsed' else '[]'::jsonb end) as a
        union all
        select e->>'subagent'
        from jsonb_array_elements(case when jsonb_typeof(t.m->'metadata'->'subagentRuns') = 'array' then t.m->'metadata'->'subagentRuns' else '[]'::jsonb end) e
        where jsonb_typeof(e) = 'object'
        union all
        select case when r[1]::integer - r[2]::integer > 0 then 'rag' end
        from (select regexp_match(s, '^\[RAG CONTEXT GENERATED\] ragArray size=(\d+) \(termasuk (\d+)') r
              from jsonb_array_elements_text(case when jsonb_typeof(t.m->'steps') = 'array' then t.m->'steps' else '[]'::jsonb end) s) x
        where r is not null
        union all
        select case when r[2]::integer > 0 then 'web' end
        from (select regexp_match(s, '^\[RAG CONTEXT GENERATED\] ragArray size=(\d+) \(termasuk (\d+)') r
              from jsonb_array_elements_text(case when jsonb_typeof(t.m->'steps') = 'array' then t.m->'steps' else '[]'::jsonb end) s) x
        where r is not null
        union all
        select case when (regexp_match(s, 'memoryArray size=(\d+)\s*$'))[1]::integer > 0 then 'memori' end
        from jsonb_array_elements_text(case when jsonb_typeof(t.m->'steps') = 'array' then t.m->'steps' else '[]'::jsonb end) s
        where s like '[MEMORY PROMPT GENERATED]%'
      ) y
      where a is not null and a <> ''
      order by a
    )
  from public.chats c,
       jsonb_array_elements(case when jsonb_typeof(c.messages) = 'array' then c.messages else '[]'::jsonb end) with ordinality t(m, i)
  where c.id = p_chat
    and c.user_id = (select auth.uid())
  order by t.i
  limit 300;
$$;

revoke execute on function public.hitungan_graf_home() from public, anon;
revoke execute on function public.pesan_percakapan_graf(uuid) from public, anon;
grant execute on function public.hitungan_graf_home() to authenticated;
grant execute on function public.pesan_percakapan_graf(uuid) to authenticated;
