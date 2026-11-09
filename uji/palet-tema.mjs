
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const keHex = (rgb) => '#' + rgb.trim().split(/\s+/).map((n) => Number(n).toString(16).padStart(2, '0')).join('');

export function bacaPalet(akar, tema = 'ruangan-kayu') {
  const teks = readFileSync(join(akar, 'frontend', 'src', 'tema', `${tema}.css`), 'utf8').replace(/\r\n/g, '\n');
  const tanpaKomentar = teks.replace(/\/\*[\s\S]*?\*\//g, '');
  const VAR = Object.fromEntries([...tanpaKomentar.matchAll(/--warna-([a-z0-9-]+):\s*(\d+\s+\d+\s+\d+)\s*;/g)].map((m) => [m[1], keHex(m[2])]));
  const SLATE = Object.fromEntries(Object.entries(VAR).filter(([k]) => /^slate-\d+$/.test(k)).map(([k, v]) => [k.slice(6), v]));
  const TOKEN = Object.fromEntries(Object.entries(VAR).filter(([k]) => !/^slate-\d+$/.test(k) && k !== 'kilau' && !k.startsWith('menu-')));
  return { VAR, TOKEN, SLATE, teks };
}
