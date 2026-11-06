
export function buatPenandaKiriman({ seq, chatId, pesan }) {
  return {
    seq,
    chatId: chatId ?? null,
    pesan: Array.isArray(pesan) ? [...pesan] : []
  };
}

export function masihPercakapanSama(penanda, seqSekarang) {
  return !!penanda && penanda.seq === seqSekarang;
}

export function tujuanTulis(penanda, seqSekarang) {
  return masihPercakapanSama(penanda, seqSekarang) ? 'layar' : 'terlantar';
}

export function pesanTerlantar(penanda, jawaban) {
  const isi = typeof jawaban === 'string' ? jawaban : String(jawaban?.content ?? '');
  const tambahan = typeof jawaban === 'string' ? { role: 'model', content: isi } : { ...jawaban, role: 'model', content: isi };
  return [...(penanda?.pesan || []), tambahan];
}

export function layakSimpanTerlantar(penanda, jawaban) {
  const isi = typeof jawaban === 'string' ? jawaban : String(jawaban?.content ?? '');
  return !!penanda && (penanda.pesan || []).length > 0 && isi.trim().length > 0;
}
