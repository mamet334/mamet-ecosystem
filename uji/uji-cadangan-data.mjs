// UJI Item 93 Tahap 1 — cadanganData.js dengan supabase tiruan (paginasi, hitungan, pemeriksaan berkas).
import { pathToFileURL } from 'node:url';
const C = await import(pathToFileURL('D:/SLAMET/other/mamet os ecosystem/frontend/src/core/runtime/services/cadanganData.js').href + '?v=' + Date.now());
console.log('uji-cadangan-data v1');
let gagal = 0; const cek = (ok, pesan) => { console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${pesan}`); if (!ok) gagal++; };

// Tiruan: tiap tabel punya N baris; range() menghormati batas; count exact; opsi "tambahSaatHitung" meniru baris baru.
function tiruan(jumlah, { tambahSaatHitung = {}, galat = {} } = {}) {
  const panggilan = [];
  return {
    panggilan,
    from(nama) {
      const q = { nama, dari: 0, sampai: 0, head: false, urut: null };
      const p = {
        select(_k, opsi) { if (opsi?.head) q.head = true; return p; },
        order(k) { q.urut = k; return p; },
        range(a, b) { q.dari = a; q.sampai = b; return p; },
        then(res) {
          if (galat[nama]) return res({ data: null, error: { message: galat[nama] } });
          const n = jumlah[nama] ?? 0;
          if (q.head) { panggilan.push(`${nama}:hitung`); return res({ count: n + (tambahSaatHitung[nama] || 0), error: null }); }
          panggilan.push(`${nama}:${q.dari}-${q.sampai}:${q.urut}`);
          const data = []; for (let i = q.dari; i <= q.sampai && i < n; i++) data.push({ id: i + 1 });
          return res({ data, error: null });
        },
      };
      return p;
    },
  };
}

const jumlah = { knowledge_spaces: 3, documents: 238, document_chunks: 3604, workspace_summaries: 0, asn_berkas: 7, asn_pegawai: 1328, chats: 130, user_memories: 12, api_usage: 814, project_memory_entries: 0, engineering_tasks: 0, architecture_gaps: 0, verification_runs: 0 };
let sb = tiruan(jumlah);
const { berkas, ringkas } = await C.buatCadangan(sb, { userId: 'u1', sekarang: new Date('2026-09-22T01:00:00Z') });
cek(ringkas.cocok, 'semua tabel cocok');
cek(berkas.data.document_chunks.length === 3604, 'potongan RAG 3.604 utuh (tidak terpotong 1.000)');
cek(berkas.data.asn_pegawai.length === 1328, 'asn_pegawai 1.328 utuh');
cek(sb.panggilan.filter((x) => x.startsWith('document_chunks:') && !x.endsWith('hitung')).length === 13, 'potongan diambil per 300 (13 halaman)');
cek(sb.panggilan.every((x) => x.endsWith('hitung') || x.endsWith(':id')), 'setiap halaman berurutan id');
cek(!Object.keys(berkas.data).some((n) => /log/.test(n)), 'tidak ada tabel log di berkas');
const teks = JSON.stringify(berkas);
cek(C.periksaBerkasCadangan(JSON.parse(teks)).sah, 'berkas dibaca ulang: sah');
cek(berkas.format === 'mamet-cadangan' && berkas.versi === 1 && berkas.akun === 'u1', 'format, versi, akun');

// Baris baru masuk saat mencadangkan → terlihat sebagai tidak cocok (bukan tersembunyi)
sb = tiruan(jumlah, { tambahSaatHitung: { api_usage: 1 } });
const r2 = await C.buatCadangan(sb, { userId: 'u1' });
cek(!r2.ringkas.cocok && r2.ringkas.tabel.find((t) => t.nama === 'api_usage').db === 815, 'baris baru di tengah → api_usage tidak cocok (814 vs 815)');
const p2 = C.periksaBerkasCadangan(r2.berkas);
cek(!p2.sah && p2.masalah.some((m) => /api_usage: database 815, tercadang 814/.test(m)), `pemeriksaan menyebut tabelnya (${p2.masalah.join('; ')})`);

// Halaman gagal → melempar, tidak ada berkas setengah jadi
sb = tiruan(jumlah, { galat: { chats: 'permission denied' } });
try { await C.buatCadangan(sb, { userId: 'u1' }); cek(false, 'galat harus dilempar'); } catch (e) { cek(/chats: permission denied/.test(e.message), 'galat satu tabel dilempar dengan nama tabel'); }

// Berkas rusak / bukan cadangan
const rusak = JSON.parse(teks); rusak.data.documents.pop();
cek(!C.periksaBerkasCadangan(rusak).sah, 'isi berkurang terdeteksi');
cek(!C.periksaBerkasCadangan({ format: 'lain' }).sah, 'bukan berkas cadangan ditolak');
cek(C.namaBerkasCadangan(new Date('2026-09-22T01:05:00Z')) === 'mamet-cadangan-2026-09-22-01-05.json', 'nama berkas');

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : gagal + ' GAGAL'}`);
process.exit(gagal ? 1 : 0);
