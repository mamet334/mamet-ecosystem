alter table public.document_chunks set (toast_tuple_target = 8160);
alter table public.document_chunks alter column embedding set storage main;
cluster public.document_chunks using document_chunks_pkey;
analyze public.document_chunks;
