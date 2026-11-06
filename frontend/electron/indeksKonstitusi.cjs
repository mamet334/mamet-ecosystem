const fs = require('fs');
const path = require('path');

const BERKAS_AKAR = ['INIT.md', 'AGENTS.md'];

const FOLDER = 'constitution';

const HURUF_KEPALA = 2000;

const rapat = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function judulBerguna(alamatPenuh, relatif) {
  let judul = '';
  try {
    const kepala = fs.readFileSync(alamatPenuh, 'utf-8').slice(0, HURUF_KEPALA);
    const m = kepala.match(/^#\s+(.+)$/m);
    judul = m ? m[1].replace(/\s+/g, ' ').trim() : '';
  } catch {
    return '';
  }
  if (!judul) return '';
  const nama = relatif.split('/').pop().replace(/\.md$/i, '');
  const menambah = !rapat(nama).includes(rapat(judul)) && !rapat(judul).includes(rapat(nama));
  return menambah ? judul.slice(0, 70) : '';
}

function indeksKonstitusi(akar) {
  if (!akar || typeof akar !== 'string') return [];
  const hasil = [];
  const tambah = (relatif) => {
    const penuh = path.join(akar, relatif);
    if (!fs.existsSync(penuh)) return;
    hasil.push({ alamat: relatif, judul: judulBerguna(penuh, relatif) });
  };

  for (const f of BERKAS_AKAR) tambah(f);

  const dir = path.join(akar, FOLDER);
  if (fs.existsSync(dir)) {
    let isi = [];
    try {
      isi = fs.readdirSync(dir);
    } catch {
      return hasil;
    }
    for (const f of isi.filter((x) => x.toLowerCase().endsWith('.md')).sort()) {
      tambah(`${FOLDER}/${f}`);
    }
  }
  return hasil;
}

module.exports = { indeksKonstitusi, judulBerguna, BERKAS_AKAR, FOLDER, HURUF_KEPALA };
