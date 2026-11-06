
export const KUNCI_LOKAL = 'mamet_tampilan';

export const DASAR = Object.freeze(['gelap', 'terang']);
export const PILIHAN_SISTEM = 'sistem';

export const META_CADANGAN = Object.freeze({
  bawaan: 'ruangan-kayu',
  ikutiSistem: { gelap: 'ruangan-kayu', terang: 'ruangan-kayu' },
  themes: [{ id: 'ruangan-kayu', nama: 'Ruangan kayu', keterangan: 'Hangat, berlatar dinding kayu seperti layar masuk.', dasar: 'gelap', latarRuangan: true, nilai: null }],
});

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

export function metaDipakai(meta) {
  return meta && periksaMeta(meta).length === 0 ? meta : META_CADANGAN;
}

export const PILIHAN_GERAK = Object.freeze(['sistem', 'kurangi', 'normal']);

export function normalisasiSetelan(mentah, meta) {
  const m = metaDipakai(meta);
  const ids = m.themes.map((t) => t.id);
  const tema = mentah?.tema === PILIHAN_SISTEM || ids.includes(mentah?.tema) ? mentah.tema : m.bawaan;
  const latarRuangan = typeof mentah?.latarRuangan === 'boolean' ? mentah.latarRuangan : null;
  const gerak = PILIHAN_GERAK.includes(mentah?.gerak) ? mentah.gerak : 'sistem';
  const lampu = typeof mentah?.lampu === 'boolean' ? mentah.lampu : false;
  return { tema, latarRuangan, gerak, lampu };
}

export function lampuNyala(setelan, latarSedangNyala) {
  return setelan?.lampu === true && !!latarSedangNyala;
}

export function gerakDikurangi(setelan, sistemKurangi) {
  const g = PILIHAN_GERAK.includes(setelan?.gerak) ? setelan.gerak : 'sistem';
  return g === 'kurangi' || (g === 'sistem' && !!sistemKurangi);
}

export function pilihTema(setelan, sistemGelap, meta) {
  const m = metaDipakai(meta);
  const s = normalisasiSetelan(setelan, m);
  return s.tema === PILIHAN_SISTEM ? m.ikutiSistem[sistemGelap ? 'gelap' : 'terang'] : s.tema;
}

export function dasarTema(idTema, meta) {
  const m = metaDipakai(meta);
  const d = m.themes.find((t) => t.id === idTema)?.dasar;
  return DASAR.includes(d) ? d : 'gelap';
}

export function latarNyala(setelan, idTema, meta) {
  const m = metaDipakai(meta);
  const s = normalisasiSetelan(setelan, m);
  if (dasarTema(idTema, m) === 'terang') return false;
  if (s.latarRuangan !== null) return s.latarRuangan;
  return m.themes.find((t) => t.id === idTema)?.latarRuangan ?? true;
}

export function aturanCssTema(meta) {
  const m = metaDipakai(meta);
  return m.themes.filter((t) => t.nilai).map((t) => {
    const isi = Object.entries(t.nilai).map(([k, v]) => `  --warna-${k}: ${v};`).join('\n');
    return `html[data-tema="${t.id}"],\n[data-tema="${t.id}"] {\n${isi}\n}`;
  }).join('\n\n');
}
