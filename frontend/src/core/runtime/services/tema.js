// Logika tema aplikasi (Item 128 Tahap B) — MURNI: tanpa DOM, tanpa Supabase, tanpa localStorage, supaya bisa diuji
// langsung di node. Yang menyentuh dunia luar ada di TemaService.js.
//
// Bentuk metadata: public/metadata/themes.json (MUS §21) — { bawaan, ikutiSistem: { gelap, terang }, themes: [...] }.
// Tema bawaan mengambil nilainya dari frontend/src/tema/<id>.css (`nilai: null`); tema lain menuliskan nilai setiap
// variabel --warna-* di metadata. Setelan pengguna: { tema: <id> | 'sistem', latarRuangan: true | false | null }
// — latarRuangan null = ikut bawaan temanya.

export const KUNCI_LOKAL = 'mamet_tampilan';

/** Warna dasar (Item 128 Tahap D1): fondasi putih/hitam/warna status yang dipilih tiap tema — src/tema/dasar-<id>.css. */
export const DASAR = Object.freeze(['gelap', 'terang']);
export const PILIHAN_SISTEM = 'sistem';

/** Metadata cadangan bila themes.json gagal dimuat: aplikasi tetap jalan dengan tema bawaan saja. */
export const META_CADANGAN = Object.freeze({
  bawaan: 'ruangan-kayu',
  ikutiSistem: { gelap: 'ruangan-kayu', terang: 'ruangan-kayu' },
  themes: [{ id: 'ruangan-kayu', nama: 'Ruangan kayu', keterangan: 'Hangat, berlatar dinding kayu seperti layar masuk.', dasar: 'gelap', latarRuangan: true, nilai: null }],
});

/** Kesalahan bentuk metadata — daftar kosong = sah. */
export function periksaMeta(meta) {
  const salah = [];
  const ids = new Set((meta?.themes || []).map((t) => t?.id));
  if (!Array.isArray(meta?.themes) || meta.themes.length === 0) salah.push('themes kosong');
  if (!ids.has(meta?.bawaan)) salah.push(`bawaan "${meta?.bawaan}" tak ada di themes`);
  for (const sisi of ['gelap', 'terang']) if (!ids.has(meta?.ikutiSistem?.[sisi])) salah.push(`ikutiSistem.${sisi} tak menunjuk tema yang ada`);
  for (const t of meta?.themes || []) {
    if (!/^[a-z0-9-]+$/.test(t?.id || '')) salah.push(`id tema tak sah: ${t?.id}`);
    if (!t?.nama) salah.push(`tema ${t?.id} tanpa nama`);
    if (typeof t?.latarRuangan !== 'boolean') salah.push(`tema ${t?.id}: latarRuangan harus true/false`);
    if (!DASAR.includes(t?.dasar)) salah.push(`tema ${t?.id}: dasar harus salah satu dari ${DASAR.join('/')}`);
    if (t?.id !== meta?.bawaan && (t?.nilai == null || typeof t.nilai !== 'object')) salah.push(`tema ${t?.id} bukan bawaan tetapi tanpa nilai`);
    for (const [k, v] of Object.entries(t?.nilai || {})) {
      if (!/^[a-z0-9-]+$/.test(k)) salah.push(`tema ${t.id}: nama variabel tak sah ${k}`);
      if (!/^\d{1,3} \d{1,3} \d{1,3}$/.test(String(v)) || String(v).split(' ').some((n) => Number(n) > 255)) salah.push(`tema ${t.id}: nilai ${k} bukan "R G B"`);
    }
  }
  return salah;
}

/** Metadata yang dipakai: yang dimuat bila sah, selain itu cadangan. */
export function metaDipakai(meta) {
  return meta && periksaMeta(meta).length === 0 ? meta : META_CADANGAN;
}

/**
 * "Kurangi gerakan" (Item 128 Tahap C): 'sistem' = ikuti setelan animasi Windows (prefers-reduced-motion) — bawaan;
 * 'kurangi' = selalu tanpa gerakan; 'normal' = selalu dengan gerakan. Bawaan mengikuti sistem, jadi pengguna yang
 * tidak mengubah apa pun melihat aplikasi persis seperti sebelumnya kecuali Windows-nya sendiri meminta gerakan dikurangi.
 */
export const PILIHAN_GERAK = Object.freeze(['sistem', 'kurangi', 'normal']);

/** Setelan mentah (dari localStorage / akun) → setelan sah. Nilai yang tak dikenal jatuh ke bawaan. */
export function normalisasiSetelan(mentah, meta) {
  const m = metaDipakai(meta);
  const ids = m.themes.map((t) => t.id);
  const tema = mentah?.tema === PILIHAN_SISTEM || ids.includes(mentah?.tema) ? mentah.tema : m.bawaan;
  const latarRuangan = typeof mentah?.latarRuangan === 'boolean' ? mentah.latarRuangan : null;
  const gerak = PILIHAN_GERAK.includes(mentah?.gerak) ? mentah.gerak : 'sistem';
  // Lampu (Item 128 Tahap C): mati bawaannya — keputusan Owner 20 Okt.
  const lampu = typeof mentah?.lampu === 'boolean' ? mentah.lampu : false;
  return { tema, latarRuangan, gerak, lampu };
}

/** Pendar lampu tampil hanya bila pengguna menyalakannya DAN latar ruangan nyala — lampu bagian dari ruangan. */
export function lampuNyala(setelan, latarSedangNyala) {
  return setelan?.lampu === true && !!latarSedangNyala;
}

/** Apakah gerakan dikurangi untuk setelan ini. `sistemKurangi` = Windows meminta animasi dikurangi. */
export function gerakDikurangi(setelan, sistemKurangi) {
  const g = PILIHAN_GERAK.includes(setelan?.gerak) ? setelan.gerak : 'sistem';
  return g === 'kurangi' || (g === 'sistem' && !!sistemKurangi);
}

/** Tema yang benar-benar tampil untuk setelan ini. "Ikuti sistem" membaca sisi gelap/terang Windows. */
export function pilihTema(setelan, sistemGelap, meta) {
  const m = metaDipakai(meta);
  const s = normalisasiSetelan(setelan, m);
  return s.tema === PILIHAN_SISTEM ? m.ikutiSistem[sistemGelap ? 'gelap' : 'terang'] : s.tema;
}

/** Warna dasar tema yang tampil — `gelap` bila tak dikenal. */
export function dasarTema(idTema, meta) {
  const m = metaDipakai(meta);
  const d = m.themes.find((t) => t.id === idTema)?.dasar;
  return DASAR.includes(d) ? d : 'gelap';
}

/** Apakah dinding ruangan tampil: pilihan pengguna, atau bawaan tema bila pengguna belum memilih. */
export function latarNyala(setelan, idTema, meta) {
  const m = metaDipakai(meta);
  const s = normalisasiSetelan(setelan, m);
  // Tema berdasar terang: dinding kayu (gelap) tak pernah tampil — teks gelapnya tak terbaca di atas dinding gelap.
  // Pilihan pengguna tetap tersimpan dan berlaku lagi bila kembali ke tema gelap.
  if (dasarTema(idTema, m) === 'terang') return false;
  if (s.latarRuangan !== null) return s.latarRuangan;
  return m.themes.find((t) => t.id === idTema)?.latarRuangan ?? true;
}

/**
 * Aturan CSS untuk setiap tema yang punya nilai di metadata. Selektornya dua: `html[data-tema=…]` (lebih spesifik
 * dari `:root` di berkas tema bawaan, jadi tema terpilih selalu menang) dan `[data-tema=…]` (kotak pratinjau di
 * Settings memakai tema lain di dalam dirinya sendiri, tanpa mengganti tema halaman).
 */
export function aturanCssTema(meta) {
  const m = metaDipakai(meta);
  return m.themes.filter((t) => t.nilai).map((t) => {
    const isi = Object.entries(t.nilai).map(([k, v]) => `  --warna-${k}: ${v};`).join('\n');
    return `html[data-tema="${t.id}"],\n[data-tema="${t.id}"] {\n${isi}\n}`;
  }).join('\n\n');
}
