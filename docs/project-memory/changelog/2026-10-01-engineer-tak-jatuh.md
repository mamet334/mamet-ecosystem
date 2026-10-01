# 1 Oktober 2026 — Engineer tidak boleh pernah jatuh ke jalur ringan

## Keputusan Owner

> *"2. engineer tidak boleh pernah jatuh"*

Dipilih dari dua temuan terbuka, dan dikerjakan sendirian.

## Koreksi atas laporan sebelumnya

Saya sempat melaporkan ini sebagai "ranjau: `AssistantService.js:561` mengirim pesan bertipe LOOKUP
ke `_handleLookup` **tanpa memeriksa mode**". Separuhnya benar, tetapi **gambarannya berlebihan**:

`RequestClassifierService` **sudah** menjaganya di hulu — begitu `resolvedMode === 'ENGINEER'`, ia
langsung mengembalikan `type: 'ENGINEER'` (baris 162) dan tidak pernah mencapai cabang LOOKUP.

Jadi lubangnya hanya terbuka lewat **satu** jalan: `resolvedMode` yang meleset.

## Jalan itu nyata — dua sumber kebenaran

`resolveMode()` membaca `workspaceId`. Dan dua tempat menjawab pertanyaan "ruang kerja mana ini"
dengan sumber yang **berbeda**:

| | Sumber |
|---|---|
| Layar menentukan dirinya Engineer | `osState?.workspaceId === 'ws-engineer'` |
| Kiriman menentukan modenya | `workspaceManager?.activeWorkspaceId \|\| 'ws-assistant'` |

Yang kedua **jatuh diam-diam ke assistant** bila `workspaceManager` belum siap atau tidak sepakat.
Layar tetap menampilkan Engineer; permintaannya berangkat sebagai Assistant.

## Yang hilang kalau ia jatuh — tiga sekaligus, tanpa satu pun tanda

| | |
|---|---|
| **Sisipan** | `history.slice(-3)`; sisipan ada di DEPAN, jadi catatan akar repo & peta repo terbuang. Patokan `_patok` tidak menolong — jalur itu **tidak memanggil `pilihPesanKonteks` sama sekali** |
| **Kontrak Engineer** | `mode: 'LOOKUP'` dikirim ke server, menimpa ENGINEER — termasuk kapabilitas "membaca kode sumber" yang baru dipasang hari ini |
| **Kelas model** | `getActiveBrainContext('KECIL')` — *"LOOKUP selalu tier ringan"* |

## Yang dikerjakan

**Satu sumber kebenaran.** Kiriman memakai penanda yang sama dengan layar:

```js
workspaceId: isEngineerWorkspace ? 'ws-engineer' : (workspaceManager?.activeWorkspaceId || 'ws-assistant'),
```

**Penjaga di dispatch**, satu nama untuk satu aturan:

```js
const jalurRinganTerlarang = resolvedMode === 'ENGINEER';
```

Dipasang di **keempat** jalur ringan — `LOOKUP`, `MEMORY_STORE`, `DOC_CONVERT`, `SKILL`. Satu yang
terlewat berarti lubang yang persis sama lewat pintu lain. Sesudah penjaga, alirannya tetap sampai
ke `_handleConversation`: Engineer tidak diam tanpa jawaban, ia hanya memakai jalur penuh.

Penjaga ini **bukan pengganti** penjaga classifier. Ia lapis kedua untuk satu-satunya jalan yang
tersisa. Keduanya dijaga uji, supaya yang satu dicabut tidak membuat yang lain kehilangan alasan.

### Yang sengaja TIDAK diubah

Jalur ringan itu sendiri tetap hidup: tier KECIL, `history.slice(-3)`, `mode: 'LOOKUP'`. Yang
diperbaiki **siapa yang boleh masuk**, bukan isi jalurnya. Melumpuhkannya akan menaikkan biaya tiap
pertanyaan pendek Assistant tanpa ada yang meminta.

## Uji

`uji/uji-engineer-tak-jatuh.mjs` (baru) — 17 pemeriksaan. **67/67 berkas uji hijau**, dua berkas
tersunting lolos parser esbuild.

Classifier diuji **dijalankan sungguhan**, bukan dibaca teksnya: tiga pertanyaan faktual pendek
("apa itu RLS?", "berapa baris main.cjs?", "siapa penulis berkas ini?") — justru jenis yang paling
mungkin tergolong LOOKUP — dipastikan menghasilkan `ENGINEER`. Mode ASSISTANT dipastikan **tidak**
ikut terkunci.

Satu asersi memindai **semua** cabang `requestType` dan gagal bila ada yang tak berpenjaga — bukan
memeriksa keempatnya satu per satu, karena daftar yang ditulis tangan akan ketinggalan saat cabang
baru ditambahkan.

## Belum sampai ke aplikasi

Ada di `main`. Perubahan di renderer saja — ikut rilis berikutnya, tidak perlu deploy.

## Catatan: ini BUKAN sebab peta hilang

Log 1 Okt 13.12 menyebut `[RequestParser] Mode diterima: ENGINEER` di kedua kiriman, jadi jalur ini
tidak menyala saat peta menghilang. Peta yang lenyap di kiriman lanjutan **masih belum terpecahkan**;
tiga teori sudah ditumbangkan angka (anggaran sempit, turun ke LOOKUP, jendela konteks). Langkah
berikutnya **memasang instrumen di sisi klien**, bukan menebak teori keempat.
