
const SOAL_SEBAGAI_TENTANG = /(?<!\b(?:contoh|latihan|kumpulan|bank|kunci|pembahasan|jawaban|lembar|paket|naskah|kisi-kisi|buat|buatkan|membuat|jawab|kerjakan|mengerjakan)\s+)(?<!-)\bsoal\b(?!-)/gi;

export function ringkasKueri(q) {
  return String(q || '')
    .replace(/[“”"'`?!.,:;()\[\]]/g, ' ')
    .replace(SOAL_SEBAGAI_TENTANG, ' ')
    .replace(/\b(tolong|mohon|lakukan|carikan|cari|temukan|riset|risetkan|telusuri|susun|susunkan|buat|buatkan|laporan|analisis|analisa|mendalam|lengkap|detail|informasi|info|data|berita|tentang|mengenai|terkait|seputar|apa|siapa|saja|dan|yang|pada|tahun|untuk|dengan|secara|di|ke|dari|dong|deh|sih|nih)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 8)
    .join(' ');
}

export function adalahKueriWaktu(teks) {
  if (!teks || typeof teks !== 'string') return false;
  return /\b(terbaru|terkini|hari ini|minggu ini|bulan ini|tahun ini|sekarang|saat ini|berita|update|teranyar|latest|recent|currently|current|today|this week|this month|news)\b/i.test(teks);
}
