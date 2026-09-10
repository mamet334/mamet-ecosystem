-- Migration: 20260910000750_guard_match_memories_target_user.sql
-- Item 45 langkah 1: pasang guard auth.uid() di overload 4-argumen.
--
-- Migrasi 20260902103500 memperkenalkan parameter target_user_id, tapi tanpa
-- guard parameter itu hanyalah masukan biasa: karena fungsinya SECURITY DEFINER
-- (menembus RLS) dan di-GRANT ke `authenticated`, siapa pun yang login bisa
-- menyodorkan UUID milik orang lain dan membaca memorinya.
--
-- Pola guardnya sengaja disamakan persis dengan check_daily_quota dan
-- get_active_knowledge di database yang sama: service_role tetap bebas (edge
-- function memakainya), user login hanya boleh menyebut dirinya sendiri.

CREATE OR REPLACE FUNCTION public.match_memories(
    query_embedding vector,
    match_threshold double precision,
    match_count integer,
    target_user_id uuid
)
RETURNS TABLE(id uuid, summary text, similarity double precision)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role'
       AND auth.uid() IS DISTINCT FROM target_user_id THEN
        RAISE EXCEPTION 'Unauthorized: access denied to other users memories';
    END IF;

    RETURN QUERY
    SELECT
        user_memories.id,
        user_memories.summary,
        1 - (user_memories.embedding <=> query_embedding) AS similarity
    FROM public.user_memories
    WHERE user_memories.user_id = target_user_id
      AND 1 - (user_memories.embedding <=> query_embedding) > match_threshold
    ORDER BY user_memories.embedding <=> query_embedding
    LIMIT match_count;
END;
$function$;
