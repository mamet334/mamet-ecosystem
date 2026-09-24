// UJI Item 85 Tahap 3 — buangKakiTiruan: catatan kaki "dicatat dari proses utama" buatan model dibuang (kasus live).
import { pathToFileURL } from 'node:url';
const F = await import(pathToFileURL('D:/SLAMET/other/mamet os ecosystem/frontend/src/core/runtime/services/folderKerjaAlat.js').href + '?v=' + Date.now());
console.log('uji-folder-kaki-tiruan v1');
let gagal = 0; const cek = (ok, pesan, rinci) => { console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}${!ok && rinci !== undefined ? `\n      → ${JSON.stringify(rinci)}` : ''}`); if (!ok) gagal++; };

// Live chat 2 (git status): jawaban model SEBELUM catatan kaki asli ditambahkan.
const git = 'Pak Slamet, hasilnya **gagal**.\n\n```\nfatal: not a git repository\n```\n\n[STATUS: HYPOTHESIS - Rekomendasi AI]\n\n---\n📂 _Folder kerja: **uji-folder-kerja**_\n⚠️ _Perintah `git status` gagal (kode 128): folder bukan repository Git._';
let h = F.buangKakiTiruan(git);
cek(h.endsWith('[STATUS: HYPOTHESIS - Rekomendasi AI]') && h.includes('fatal: not a git repository'), 'live chat 2: blok 📂/⚠️ tiruan dibuang, isi & label tetap', h);

// Live chat 3 (Tolak) & 4 (cmd): baris "dicatat dari proses utama" buatan model.
const tolak = 'Baik Pak, saya **tidak menjalankan** `app.py`.\n\n[STATUS: HYPOTHESIS - Rekomendasi AI]\n\n---\n📂 _Folder kerja: **uji-folder-kerja**_\n✍️ _Perintah & perubahan (dicatat dari proses utama, bukan dari kata model): ⛔ `python app.py` ditolak owner — tidak dijalankan._';
h = F.buangKakiTiruan(tolak);
cek(!/dicatat dari proses utama/.test(h) && !h.includes('---') && h.includes('tidak menjalankan'), 'live chat 3: klaim sistem tiruan dibuang', h);
const cmd = 'Maaf Pak, saya **tidak bisa** menjalankan `dir` lewat `cmd`.\n\n```json\n{"alat":"folder_list","alamat":"."}\n```\n\n[STATUS: HYPOTHESIS - Rekomendasi AI]\n\n---\n📂 _Folder kerja: **uji-folder-kerja**_\n✍️ _Perintah & perubahan (dicatat dari proses utama, bukan dari kata model): ⛔ `dir` via `cmd` ditolak sistem (shell tidak tersedia)._';
h = F.buangKakiTiruan(cmd);
cek(!/dicatat dari proses utama/.test(h) && h.includes('"alat":"folder_list"') && h.endsWith('[STATUS: HYPOTHESIS - Rekomendasi AI]'), 'live chat 4 (tanpa alat sama sekali): klaim tiruan dibuang', h);

// Klaim di tengah jawaban (tanpa ---) juga dibuang
h = F.buangKakiTiruan('Isi.\n✍️ _Perubahan (dicatat dari proses utama, bukan dari kata model): ✅ `x.py`_\nLanjut.');
cek(h === 'Isi.\nLanjut.', 'klaim tiruan di tengah jawaban dibuang', h);

// Yang TIDAK boleh ikut terbuang
const tabel = 'Ringkasan.\n\n---\n\n| A | B |\n|---|---|\n| 1 | 2 |';
cek(F.buangKakiTiruan(tabel) === 'Ringkasan.\n\n---\n\n| A | B |\n|---|---|\n| 1 | 2 |', 'pemisah --- dengan isi biasa (tabel) tetap', F.buangKakiTiruan(tabel));
const miring = 'Hasil:\n\n---\n_Catatan: angka dibulatkan._\nJumlah 27.';
cek(F.buangKakiTiruan(miring) === miring, 'bagian --- berisi teks miring biasa + kalimat tetap');
const biasa = 'Jumlah: 27\nRata-rata: 9.0\n\n[STATUS: VERIFIED - Dokumen]';
cek(F.buangKakiTiruan(biasa) === biasa, 'jawaban tanpa catatan kaki tidak berubah');
cek(F.buangKakiTiruan('```\nfatal: x\n```') === '```\nfatal: x\n```', 'blok kode tetap');

// Jawaban live chat 1 lengkap (dengan catatan kaki asli dari putaran sebelumnya di teks) → catatan kaki lama dibuang,
// catatan kaki asli ditambahkan ulang oleh AssistantService sesudahnya.
const satu = 'Selesai Pak.\n\nJumlah: 27\n\n[STATUS: HYPOTHESIS - Rekomendasi AI]\n\n---\n📂 _Dibaca dari folder **uji-folder-kerja** (4 putaran): `app.py`_\n✍️ _Perubahan & perintah (dicatat dari proses utama, bukan dari kata model): ✅ `app.py`, ▶️ kode 0 `python app.py`_';
cek(F.buangKakiTiruan(satu) === 'Selesai Pak.\n\nJumlah: 27\n\n[STATUS: HYPOTHESIS - Rekomendasi AI]', 'catatan kaki bergaya sistem di teks model dibuang seluruhnya', F.buangKakiTiruan(satu));

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : gagal + ' GAGAL'}`);
process.exit(gagal ? 1 : 0);
