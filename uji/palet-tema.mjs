// Pembaca palet tema untuk uji — BUKAN berkas uji (namanya tidak berawalan `uji-`, jadi tak dijalankan penjalan).
//
// Sejak Item 128 Tahap A (20 Okt 2026) nilai palet tidak lagi ditulis sebagai hex di tailwind.config.js — config hanya
// menunjuk variabel CSS, dan nilainya ada di frontend/src/tema/<tema>.css dalam bentuk saluran "R G B". Uji yang
// mengukur warna (kontras, kehangatan, dinding) membaca dari sini, supaya semuanya memakai satu cara membaca yang sama.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const keHex = (rgb) => '#' + rgb.trim().split(/\s+/).map((n) => Number(n).toString(16).padStart(2, '0')).join('');

/**
 * @returns {{ VAR: Record<string,string>, TOKEN: Record<string,string>, SLATE: Record<string,string>, teks: string }}
 *   VAR   — semua variabel --warna-* → "#rrggbb"
 *   TOKEN — token Tailwind (tanpa slate, tanpa variabel non-token) → "#rrggbb"
 *   SLATE — tingkat slate ("50".."950") → "#rrggbb"
 */
export function bacaPalet(akar, tema = 'ruangan-kayu') {
  const teks = readFileSync(join(akar, 'frontend', 'src', 'tema', `${tema}.css`), 'utf8').replace(/\r\n/g, '\n');
  const tanpaKomentar = teks.replace(/\/\*[\s\S]*?\*\//g, '');
  const VAR = Object.fromEntries([...tanpaKomentar.matchAll(/--warna-([a-z0-9-]+):\s*(\d+\s+\d+\s+\d+)\s*;/g)].map((m) => [m[1], keHex(m[2])]));
  const SLATE = Object.fromEntries(Object.entries(VAR).filter(([k]) => /^slate-\d+$/.test(k)).map(([k, v]) => [k.slice(6), v]));
  // Bukan token Tailwind: kilau (kelas global) dan menu-* (MenuTeks, Item 128 Tahap B).
  const TOKEN = Object.fromEntries(Object.entries(VAR).filter(([k]) => !/^slate-\d+$/.test(k) && k !== 'kilau' && !k.startsWith('menu-')));
  return { VAR, TOKEN, SLATE, teks };
}
