
export function putusanPemulihan(hasil) {
  if (hasil && Array.isArray(hasil.messages)) return 'pakai';
  if (hasil && hasil.hilang === true) return 'lepas';
  return 'pertahankan';
}

export function kunciSimpan({ chatId, messages }) {
  const daftar = Array.isArray(messages) ? messages : [];
  const terakhir = daftar[daftar.length - 1];
  const nilai = daftar.reduce((s, m, i) => (m?.umpanBalik ? `${s}${i}${m.umpanBalik > 0 ? '+' : '-'}` : s), '');
  return `${chatId || 'new'}_${daftar.length}_${(terakhir?.content || '').length}_${terakhir?.role || ''}${nilai ? `_${nilai}` : ''}`;
}

export function bolehSimpanChat({ currentChatId, messages }) {
  if (!Array.isArray(messages) || messages.length === 0) return false;
  if (currentChatId) return true;
  return messages.some((m) => m && m.role === 'user');
}
