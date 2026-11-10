drop function if exists public.match_documents_hybrid_biner(vector, text[], double precision, integer, uuid, uuid, integer);
drop function if exists public.match_documents_hybrid_biner(vector, text[], double precision, integer, uuid, uuid, integer, integer);
drop index if exists public.document_chunks_bit_hnsw;
alter table public.document_chunks drop column if exists embedding_bit;
