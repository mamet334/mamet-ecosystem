// UJI workspace Research App (2026-09-21) — logika murni + lapisan DB dengan supabase tiruan.
import { pathToFileURL } from 'node:url';
const M = await import(pathToFileURL('D:/SLAMET/other/mamet os ecosystem/frontend/src/core/runtime/services/ruangPengetahuan.js').href + '?v=' + Date.now());
console.log('uji-ruang-pengetahuan v1');
let gagal = 0; const cek = (ok, pesan) => { console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}`); if (!ok) gagal++; };

const daftar = [
  { id: 'k', name: 'Kepbup OKU 2025', space_type: 'WORKSPACE' },
  { id: 'c', name: 'My Core Knowledge', space_type: 'CORE' },
];
let r = M.periksaNamaRuang('  Rekon   ASN  2026 ', daftar); cek(r.ok && r.nama === 'Rekon ASN 2026', 'nama dirapikan');
cek(!M.periksaNamaRuang('   ', daftar).ok, 'nama kosong ditolak');
cek(!M.periksaNamaRuang('x'.repeat(61), daftar).ok, '61 huruf ditolak');
cek(M.periksaNamaRuang('x'.repeat(60), daftar).ok, '60 huruf diterima');
cek(!M.periksaNamaRuang('kepbup oku 2025', daftar).ok, 'kembar beda huruf besar ditolak');
cek(M.periksaNamaRuang('Kepbup OKU 2025', daftar, 'k').ok, 'ganti nama ke nama sendiri boleh');
cek(!M.periksaNamaRuang('Global', daftar).ok, '"global" ditolak');
cek(M.pilihRuangAwal(daftar, 'c') === 'c', 'pilihan tersimpan dipakai');
cek(M.pilihRuangAwal(daftar, 'hilang') === 'k', 'pilihan tersimpan yang sudah dihapus → terbaru');
cek(M.pilihRuangAwal([], null) === null, 'daftar kosong → null');
cek(!M.bolehDihapus(daftar[1]) && M.bolehDihapus(daftar[0]), 'CORE tak boleh dihapus');
M.ingatRuangTerpilih('k'); cek(M.ruangTerpilihTersimpan() === null || typeof M.ruangTerpilihTersimpan() === 'string', 'tanpa localStorage tidak melempar');

// supabase tiruan
function tiruan({ jumlahDok = 0, hapusBaris = 1 } = {}) {
  const log = [];
  const rantai = (tabel) => {
    const q = { tabel, ops: [] };
    const p = new Proxy({}, { get(_, k) {
      if (k === 'then') {
        const hasil = tabel === 'documents' ? { count: jumlahDok, error: null } : { data: Array(hapusBaris).fill({ id: 's' }), error: null };
        log.push(`${tabel}:${q.ops.join(',')}`);
        return (res) => res(hasil);
      }
      return (...a) => { q.ops.push(`${k}(${a.map((x) => typeof x === 'object' ? JSON.stringify(x) : x).join('|')})`); return p; };
    } });
    return p;
  };
  return { from: rantai, log };
}
let sb = tiruan({ jumlahDok: 3 });
try { await M.hapusRuangKosong(sb, daftar[0]); cek(false, 'isi 3 dokumen harus ditolak'); }
catch (e) { cek(/3 dokumen/.test(e.message) && !sb.log.some((l) => l.startsWith('knowledge_spaces')), `berisi dokumen ditolak, tanpa DELETE (${e.message})`); }
sb = tiruan();
try { await M.hapusRuangKosong(sb, daftar[1]); cek(false, 'CORE harus ditolak'); } catch { cek(sb.log.length === 0, 'CORE ditolak sebelum ke server'); }
sb = tiruan({ jumlahDok: 0 });
await M.hapusRuangKosong(sb, daftar[0]);
cek(sb.log.some((l) => l.includes('delete()') && l.includes('neq(space_type|CORE)')), 'kosong → DELETE dengan pagar CORE');
sb = tiruan({ jumlahDok: 0, hapusBaris: 0 });
try { await M.hapusRuangKosong(sb, daftar[0]); cek(false, '0 baris harus dilaporkan'); } catch (e) { cek(/tidak ditemukan/.test(e.message), '0 baris terhapus dilaporkan'); }

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : gagal + ' GAGAL'}`);
process.exit(gagal ? 1 : 0);
