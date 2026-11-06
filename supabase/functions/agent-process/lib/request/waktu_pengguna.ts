
const PANJANG_MAKS = 64;

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

export function selisihUtc(sekarang: Date, zona: string): string {
  const nilai = bagian(sekarang, zona, { timeZoneName: 'longOffset' }).timeZoneName || 'GMT';
  return nilai === 'GMT' ? 'UTC+00:00' : nilai.replace('GMT', 'UTC');
}

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
