-- Siapa yang memilih model untuk panggilan ini: Owner atau sistem.
--
-- Kenapa ada: Roadmap Data Flywheel (Item 126) memakai "biaya per jawaban berhasil" sebagai North
-- Star. Diukur 18 Oktober 2026 pada data nyata, angka itu TERCEMAR: 74,3% seluruh biaya berasal
-- dari `deepseek-v4-pro` yang OWNER pilih sendiri di Settings, dan harganya 7x per token dibanding
-- `deepseek-v4-flash`. Artinya bulan dengan Owner yang sedang memilih model mahal akan terlihat
-- seperti sistem yang memburuk, padahal sistem tidak melakukan apa pun yang salah — dan sebaliknya,
-- sistem bisa terlihat "membaik" hanya karena Owner sedang hemat.
--
-- Tanpa kolom ini, tidak ada satu pun angka biaya di roda gila yang bisa dipakai mengambil
-- keputusan. Dengan kolom ini, metriknya terbelah jujur:
--   pemilih = sistem  -> biaya per jawaban berhasil SAH menilai sistem
--   pemilih = Owner   -> yang dinilai jumlah panggilan & token, bukan harga per panggilan
--
-- Nilai yang dipakai hari ini (klien: AssistantService; server: judge/padatkan endpoint):
--   'owner-settings'  Owner memilih model utama di Settings — termasuk mode Engineer, yang memang
--                     sengaja dikecualikan dari tier (lihat ROADMAP-ADAPTIVE-MODEL-TIERING)
--   'owner-override'  Owner menekan pil tier di kolom chat; classifier dilewati sepenuhnya
--   'tier-auto'       TierClassifierService yang memutuskan (deterministik, 0 token)
--   'sistem'          panggilan internal yang Owner tidak pilih sama sekali: hakim bayangan,
--                     pemadat konteks, Coordinator/Intent Router
--   NULL              belum diketahui — baris lama, atau jalur yang belum menandai dirinya
--
-- TIDAK diberi CHECK constraint, dan itu disengaja. `recordUsage` dipanggil lewat
-- `rctx.tasks.fire(...)` yang tidak menunggu hasilnya, jadi insert yang ditolak constraint akan
-- gagal TANPA SUARA dan diam-diam mematikan pencatatan biaya — persis bentuk kegagalan yang
-- Prinsip 6 roadmap ini larang. Nilai yang menyimpang lebih baik terlihat sebagai data aneh
-- daripada menghilang bersama barisnya. Kedisiplinan nilainya dijaga uji, bukan oleh basis data.
--
-- NULL dibiarkan apa adanya untuk baris lama (949 baris, hitungan tepat saat migrasi diterapkan
-- 18 Okt 2026; angka 818 yang sempat dikutip berasal dari `pg_class.reltuples` yang hanya
-- PERKIRAAN). Mengisinya dengan tebakan
-- akan membuat baseline berbohong sejak hari pertama; metrik "cakupan penanda pemilih" justru
-- bertugas menampakkan sisa NULL itu.
alter table public.cost_ledger
  add column if not exists pemilih_model text;

comment on column public.cost_ledger.pemilih_model is
  'Siapa yang memilih model: owner-settings | owner-override | tier-auto | sistem | NULL (belum diketahui). Tanpa CHECK dengan sengaja — lihat migrasi 20261018000000.';

-- Dibaca per bulan bersama user_id; indeks parsial supaya baris NULL (baseline lama) tidak ikut
-- membebani. Kecil: kolomnya text pendek dan tabelnya ratusan baris.
create index if not exists cost_ledger_pemilih_model_idx
  on public.cost_ledger (pemilih_model, created_at desc)
  where pemilih_model is not null;
