/**
 * KONTEKS WAKTU untuk prompt — dari jam server dan zona waktu yang dikirim browser pengguna.
 *
 * Sebab (2026-09-13): "saat ini jam berapa?" di chat baru hanya bisa dijawab dengan jam server UTC.
 * Satu chat sebelumnya menjawab "20:03 WIB untuk Anda di Indonesia" — padahal log server
 * menunjukkan riwayat 0 pesan dan tanpa memori: model MENEBAK dari bahasa pertanyaan dan tabel zona
 * waktu ebook, dan tabel itu mencatat waktu standar sehingga Dublin serta Bahamas meleset satu jam
 * (musim panas). Setelah aturan data sistem, model berhenti menebak tetapi juga berhenti membantu.
 *
 * Browser tahu zona waktunya sendiri (Intl, mis. "Asia/Jakarta"). Dengan nama zona itu server bisa
 * menghitung jam lokal yang benar — termasuk waktu musim panas — sebagai DATA, bukan tebakan.
 *
 * Tanpa impor sehingga bisa diuji langsung.
 */

const PANJANG_MAKS = 64;

/** Nama zona IANA yang sah, atau null. Menolak nilai aneh sebelum disentuh Intl. */
export function zonaWaktuSah(zona: unknown): string | null {
  if (typeof zona !== 'string') return null;
  const z = zona.trim();
  if (!z || z.length > PANJANG_MAKS || !/^[A-Za-z0-9_+/-]+$/.test(z)) return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: z });
    return z;
  } catch {
    return null;
  }
}

function bagian(sekarang: Date, zona: string, opsi: Intl.DateTimeFormatOptions) {
  const hasil: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat('en-US', { timeZone: zona, ...opsi }).formatToParts(sekarang)) hasil[p.type] = p.value;
  return hasil;
}

/** "UTC+07:00", "UTC+01:00", "UTC+00:00". */
export function selisihUtc(sekarang: Date, zona: string): string {
  const nilai = bagian(sekarang, zona, { timeZoneName: 'longOffset' }).timeZoneName || 'GMT';
  return nilai === 'GMT' ? 'UTC+00:00' : nilai.replace('GMT', 'UTC');
}

/** Tanggal YYYY-MM-DD menurut zona pengguna — bisa berbeda dengan tanggal UTC menjelang tengah malam. */
export function tanggalLokal(sekarang: Date, zona: string): string {
  const b = bagian(sekarang, zona, { year: 'numeric', month: '2-digit', day: '2-digit' });
  return `${b.year}-${b.month}-${b.day}`;
}

export function konteksWaktuPengguna(sekarang: Date, zonaMentah: unknown): string {
  const jamServer = sekarang.toISOString();
  const zona = zonaWaktuSah(zonaMentah);

  if (!zona) {
    const tanggal = jamServer.slice(0, 10);
    return `KONTEKS WAKTU (DATA SISTEM, bukan dokumen): tanggal server ${tanggal} UTC, tahun berjalan ${tanggal.slice(0, 4)}. ` +
      `Zona waktu pengguna tidak dikirim, jadi jam lokal pengguna tidak diketahui.`;
  }

  const lokal = new Intl.DateTimeFormat('id-ID', {
    timeZone: zona, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false, timeZoneName: 'short',
  }).format(sekarang);
  const tanggal = tanggalLokal(sekarang, zona);

  return `KONTEKS WAKTU (DATA SISTEM dari jam server dan zona waktu browser pengguna, bukan dokumen): ` +
    `sekarang di lokasi pengguna ${lokal} — zona ${zona}, ${selisihUtc(sekarang, zona)}. ` +
    `Tanggal hari ini bagi pengguna: ${tanggal}, tahun berjalan ${tanggal.slice(0, 4)}. Jam server: ${jamServer}. ` +
    `Bila ditanya jam atau tanggal, jawab dengan waktu lokal pengguna ini; waktu musim panas sudah diperhitungkan.`;
}
