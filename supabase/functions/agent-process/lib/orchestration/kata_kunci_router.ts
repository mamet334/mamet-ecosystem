
export const KATA_KUNCI_AKSI: readonly string[] = [
  'jadwal', 'cron', 'otomatis', 'remind', 'ingatkan',
  'search', 'google', 'internet', 'web',
  'berita', 'motogp', 'cuaca', 'saham', 'info', 'terkini', 'terbaru', 'prediksi',
  'kurs', 'harga', 'nilai', 'jumlah', 'matematika',
  'kode', 'coding', 'program', 'javascript', 'python', 'html', 'css', 'buatkan', 'tuliskan',
  'excel', 'pdf', 'file', 'dokumen',
  'youtube', 'yt', 'video', 'transkrip', 'link', 'url', 'http', 'https',
  'slack', 'discord', 'telegram', 'api', 'webhook', 'post', 'send',
  'login', 'masuk', 'sign in', 'scrape', 'credential', 'username', 'password', 'sesi',
  'workspace', 'folder', 'analisis file', 'periksa file', 'scan folder', 'baca file', 'isi folder', 'struktur folder',
  'ingat', 'ingatlah', 'nama saya', 'panggil saya', 'saya suka', 'favorit saya', 'saya alergi', 'kebiasaan saya',
  'informasi penting',
  'debat', 'rapat', 'diskusikan', 'direksi', 'ceo', 'cfo', 'cto', 'board of directors', 'keputusan bisnis',
  'shopee', 'affiliate', 'afiliate', 'promosi', 'produk', 'jual', 'komisi',
];

export const KATA_KERJA_PERINTAH: Readonly<Record<string, readonly string[]>> = {
  cari: ['cari', 'carikan', 'cariin', 'carilah', 'mencari', 'mencarikan'],
  temukan: ['temukan', 'menemukan'],
  baca: ['baca', 'bacakan', 'bacalah', 'membaca', 'membacakan'],
  ringkas: ['ringkas', 'ringkaskan', 'meringkas'],
  rangkum: ['rangkum', 'rangkumkan', 'merangkum'],
  hitung: ['hitung', 'hitungkan', 'menghitung'],
  catat: ['catat', 'catatkan', 'catatlah', 'mencatat'],
  kirim: ['kirim', 'kirimkan', 'mengirim', 'mengirimkan'],
};

const polaKata = (kata: string) =>
  new RegExp(`(?<![\\p{L}\\p{N}])${kata.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')}(?![\\p{L}\\p{N}])`, 'iu');

const DAFTAR: { kunci: string; pola: RegExp }[] = [
  ...KATA_KUNCI_AKSI.map((k) => ({ kunci: k, pola: polaKata(k) })),
  ...Object.entries(KATA_KERJA_PERINTAH).flatMap(([dasar, bentuk]) =>
    bentuk.map((b) => ({ kunci: b === dasar ? dasar : `${dasar} (${b})`, pola: polaKata(b) }))),
];

export function kataKunciAksi(pesan: string): string | null {
  if (!pesan) return null;
  for (const { kunci, pola } of DAFTAR) if (pola.test(pesan)) return kunci;
  return null;
}
