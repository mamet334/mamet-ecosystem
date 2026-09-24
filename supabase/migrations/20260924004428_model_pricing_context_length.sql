-- Panjang jendela konteks model, dalam token.
--
-- Kenapa ada: anggaran jendela konteks (Tahap 3a) semula HANYA digerakkan biaya, karena tidak ada
-- tempat menyimpan panjang jendela tiap model. Akibatnya terukur pada 24 September 2026 dengan harga
-- asli di tabel ini: batas harian $3 + `openai/gpt-4o-mini` ($0,15/1 jt) menghasilkan anggaran
-- 1.000.000 token melawan jendela nyata 128.000, dan `meta-llama/llama-3.1-8b-instruct` 3.000.000
-- melawan 131.072. Permintaan sebesar itu ditolak OpenRouter.
--
-- Angka di bawah diambil dari katalog resmi OpenRouter (https://openrouter.ai/api/v1/models) pada
-- 24 September 2026 — BUKAN dari ingatan, dan BUKAN dari dokumen ringkasan (dokumen ringkasan yang
-- ada tidak memuat satu pun model di tabel ini).
--
-- NULL berarti "belum diketahui": jalur anggaran sengaja jatuh ke perilaku lama (hanya biaya yang
-- membatasi) alih-alih memakai angka tebakan. Pelajaran Item 42: baris bernilai salah yang senyap
-- lebih berbahaya daripada baris kosong. Dua model di bawah sudah hilang dari katalog OpenRouter,
-- jadi sengaja dibiarkan NULL.
alter table public.model_pricing
  add column if not exists context_length integer;

comment on column public.model_pricing.context_length is
  'Panjang jendela konteks (token) dari katalog OpenRouter /api/v1/models. NULL = belum diketahui; jangan diisi dari ingatan.';

update public.model_pricing set context_length = 1310720 where model = 'deepseek/deepseek-v4-flash-0731';
update public.model_pricing set context_length = 1048576 where model = 'deepseek/deepseek-v4-pro-0813';
update public.model_pricing set context_length =  131072 where model = 'meta-llama/llama-3.1-8b-instruct';
update public.model_pricing set context_length =  128000 where model = 'openai/gpt-4o';
update public.model_pricing set context_length =  128000 where model = 'openai/gpt-4o-mini';
