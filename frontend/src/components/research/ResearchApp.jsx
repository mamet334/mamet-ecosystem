import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { kernel } from '../../core/runtime/Kernel';
import { Search, Upload, Trash2, FileText, Loader2, Database, PlusCircle } from 'lucide-react';
import { ekstrakTeksDokumen, perkiraanUnggah, ACCEPT_UNGGAH } from '../../core/runtime/services/documentTextExtractor.js';
import { bacaBerkasExcelAsn, adalahExcel, EKSTENSI_EXCEL } from '../../core/runtime/services/bacaExcelAsn.js';
import PratinjauDataTabel from './PratinjauDataTabel.jsx';
import DaftarDataTabel from './DaftarDataTabel.jsx';
import { opdDariNamaBerkas, siapkanSimpan, dugaVersi } from '../../core/runtime/services/dataTabelAsn.js';
import { ambilBerkasAktif, simpanBerkasAsn, daftarBerkasAsn, hapusBerkasAsn } from '../../core/runtime/services/dataTabelAsnDb.js';
import { perkiraanOcr, terapkanOcrHalaman, perkiraanMenitOcr, OCR_BANYAK_HALAMAN, OCR_SERENTAK } from '../../core/runtime/services/pdfOcrService.js';

// Di atas ini pengguna diminta konfirmasi dulu — embedding dibayar dari saldo OpenRouter-nya.
const POTONGAN_PERLU_KONFIRMASI = 150; // ±105 ribu huruf ≈ $0,006 (potongan 800 huruf, Item 70)
// Daftar dimuat per halaman; total diambil dari server agar dokumen lama tidak hilang diam-diam
// (buku Kepbup 221 berkas: batas 50 menyembunyikan dokumen terlama tanpa tanda apa pun).
const DOKUMEN_PER_HALAMAN = 50;

export default function ResearchApp() {
    const [documents, setDocuments] = useState([]);
    const [totalDokumen, setTotalDokumen] = useState(0);
    const [memuatLagi, setMemuatLagi] = useState(false);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState(() => {
        return sessionStorage.getItem('research_search_query') || '';
    });
    const [uploading, setUploading] = useState(false);
    const [statusUnggah, setStatusUnggah] = useState('');
    const [deletingId, setDeletingId] = useState(null);
    const [knowledgeSpaces, setKnowledgeSpaces] = useState([]);
    // Pratinjau data tabel Excel (Item 92 Tahap 1) — hanya di layar, belum disimpan.
    const [pratinjauTabel, setPratinjauTabel] = useState(null);
    // Data tabel tersimpan (Item 92 Tahap 2).
    const [daftarTabel, setDaftarTabel] = useState([]);
    const muatDaftarTabel = async () => {
        try { setDaftarTabel(await daftarBerkasAsn(supabase)); }
        catch (err) { console.error('[ResearchApp] Gagal memuat data tabel:', err); }
    };
    const [selectedSpace, setSelectedSpace] = useState(null);

    // Load knowledge spaces
    const loadSpaces = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { data, error } = await supabase
                .from('knowledge_spaces')
                .select('*')
                .eq('user_id', session.user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setKnowledgeSpaces(data || []);
            if (data && data.length > 0 && !selectedSpace) {
                setSelectedSpace(data[0].id);
            }
        } catch (err) {
            console.error('[ResearchApp] Gagal memuat spaces:', err);
        }
    };

    // Load documents
    // tambah = true → sambung halaman berikutnya; selain itu muat ulang sebanyak yang sudah tampil (min. satu halaman).
    const loadDocuments = async (tambah = false) => {
        const dari = tambah ? documents.length : 0;
        const sampai = tambah ? dari + DOKUMEN_PER_HALAMAN : Math.max(documents.length, DOKUMEN_PER_HALAMAN);
        if (tambah) setMemuatLagi(true); else setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            let query = supabase.from('documents').select('*', { count: 'exact' }).eq('user_id', session.user.id);
            // Jika ada query pencarian khusus, jangan batasi ke space tertentu agar dokumen selalu ditemukan
            if (selectedSpace && !searchQuery.trim()) {
                query = query.eq('space_id', selectedSpace);
            }
            if (searchQuery.trim()) {
                query = query.ilike('title', `%${searchQuery.trim()}%`);
            }

            // id sebagai pengurut kedua: created_at yang sama tidak membuat baris ganda/terlewat antar halaman.
            const { data, error, count } = await query
                .order('created_at', { ascending: false }).order('id', { ascending: true })
                .range(dari, sampai - 1);
            if (error) throw error;
            setDocuments((lama) => (tambah ? [...lama, ...(data || [])] : (data || [])));
            setTotalDokumen(count ?? 0);
        } catch (err) {
            console.error('[ResearchApp] Gagal memuat dokumen:', err);
        } finally {
            setLoading(false);
            setMemuatLagi(false);
        }
    };

    useEffect(() => {
        loadSpaces();
        muatDaftarTabel();
    }, []);

    useEffect(() => {
        setDocuments([]);
        loadDocuments();
    }, [selectedSpace, searchQuery]);

    // Upload document
    //
    // CATATAN (2026-09-10): sampai hari ini fungsi ini menulis LANGSUNG ke tabel
    // `documents` dan `document_chunks` tanpa pernah menyentuh `rag-process`.
    // Akibatnya tiga kegagalan yang semuanya diam:
    //   1. Chunk tersimpan tanpa `embedding`. Kolom itu nullable, jadi Postgres
    //      menerima tanpa protes — dokumen muncul di daftar, terlihat berhasil,
    //      tapi tidak akan pernah ditemukan pencarian RAG.
    //   2. `text.substring(0, 5000)` membuang sisa dokumen tanpa memberi tahu.
    //   3. `space_id` di-hardcode ke workspace milik satu akun, sehingga unggahan
    //      pengguna lain akan mendarat di workspace orang.
    // Semuanya kini diserahkan ke `rag-process` — jalur yang sama yang dipakai
    // mametlite, yang memotong per 4.500 karakter, memvektorkan tiap potongan,
    // dan menentukan space CORE milik pengguna yang benar di sisi server.
    // UNGGAH BANYAK BERKAS (2026-09-17): buku Kepbup dipecah per jabatan (222 berkas). Semua berkas dibaca dulu
    // (gratis, pdf.js), lalu pengguna menjawab SEKALI untuk OCR dan SEKALI untuk biaya embedding — bukan 222×
    // dialog. Berkas yang judulnya sudah ada dilewati (unggahan ganda 17 Sep). Berkas diproses berurutan;
    // satu gagal tidak menghentikan yang lain; ringkasan di akhir. Satu berkas = alur yang sama.
    const handleUpload = async (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;

        // EXCEL → jalur DATA TABEL (Item 92), bukan RAG: RAG tak bisa menghitung / mencari sel kosong. Tahap 1 hanya
        // membaca & menampilkan pratinjau di perangkat — tanpa kunci, tanpa biaya, tanpa menyimpan.
        const excel = files.filter((f) => adalahExcel(f.name));
        if (excel.length) {
            e.target.value = '';
            if (excel.length !== files.length || excel.length > 1) {
                alert('Berkas Excel dibaca lewat jalur data tabel, satu berkas setiap kali. Pilih satu berkas Excel saja (dokumen lain diunggah terpisah).');
                return;
            }
            setUploading(true);
            setStatusUnggah('Membaca Excel...');
            try {
                // Tanda unik per unggahan: dua berkas bernama sama (INSPEKTORAT senin & selasa) dulu memakai ulang layar
                // lama — termasuk tulisan "Tersimpan" — sehingga berkas kedua tampak tersimpan padahal tidak.
                setPratinjauTabel({ ...(await bacaBerkasExcelAsn(excel[0])), _unggahan: `${Date.now()}-${Math.random()}` });
            } catch (err) {
                console.error('[ResearchApp] Gagal membaca Excel:', err);
                alert(`Gagal membaca ${excel[0].name}: ${err.message || err}`);
            } finally {
                setUploading(false);
                setStatusUnggah('');
            }
            return;
        }
        const banyak = files.length > 1;
        const namaBerkas = (f) => (banyak ? `${files.indexOf(f) + 1}/${files.length} ` : '') + `"${f.name}"`;

        setUploading(true);
        const hasilAkhir = { berhasil: [], dilewati: [], gagal: [], ocrDilewati: [] };
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                alert('Sesi tidak ditemukan. Silakan masuk kembali.');
                return;
            }

            // Embedding (Item 63) dan OCR opsional (Item 76b) dibayar pengguna dengan kunci
            // OpenRouter-nya sendiri — diambil sekali di sini, dipakai untuk keduanya.
            let openRouterKey = null;
            try {
                const vault = kernel.serviceManager?.get('VaultService');
                openRouterKey = vault?.getKey('openrouter') || null;
            } catch {
                // Vault belum siap — ditangani di bawah.
            }
            // Tanpa kunci: embedding pasti ditolak rag-process DAN tawaran OCR terlewat diam-diam. Dulu tetap
            // membaca & mencoba tiap berkas → 2/2 gagal dengan pesan sama (uji 17 Sep); untuk 222 berkas = 222×.
            if (!openRouterKey) {
                alert('Kunci OpenRouter belum terpasang di aplikasi ini — unggahan dibatalkan sebelum membaca berkas.\n\n' +
                    'Pasang kunci di Pengaturan (kunci baru bila kunci lama sudah diganti), lalu unggah lagi.');
                return;
            }

            // Judul yang sudah ada di server (bukan daftar di layar, yang bisa basi) → dilewati.
            const { data: judulAda, error: errJudul } = await supabase
                .from('documents').select('title').eq('user_id', session.user.id).limit(10000);
            if (errJudul) throw errJudul;
            const sudahAda = new Set((judulAda || []).map((d) => d.title));

            // 1. Baca semua berkas. PDF/DOCX diambil teksnya di browser (Item 69); berkas teks dibaca apa adanya.
            //    Gagal (scan, terkunci, format lama…) = GagalEkstrak berpesan jelas → dicatat, berkas lain lanjut.
            const siap = [];
            for (const file of files) {
                if (sudahAda.has(file.name)) { hasilAkhir.dilewati.push(file.name); continue; }
                try {
                    setStatusUnggah(`Membaca ${namaBerkas(file)}…`);
                    const hasil = await ekstrakTeksDokumen(file, {
                        onProgress: ({ halaman, total }) => {
                            if (total) setStatusUnggah(`Membaca ${banyak ? `berkas ${files.indexOf(file) + 1}/${files.length}, ` : ''}halaman ${halaman}/${total}…`);
                        }
                    });
                    siap.push({ file, hasil });
                } catch (err) {
                    hasilAkhir.gagal.push({ nama: file.name, pesan: err.message });
                }
            }

            // 2. OCR — satu keputusan untuk semua berkas. Halaman PDF yang tampak bertabel (Item 76b): pdf.js
            //    meratakan kolomnya. OCR mistral-ocr HANYA untuk halaman itu, opsional, dan hanya bila ada kunci
            //    OpenRouter untuk membayarnya (Human-in-Command, sama seperti gerbang konfirmasi Tier 3 Web Search).
            const totalTabel = siap.reduce((a, s) => a + (s.hasil.halamanBertabelTerdeteksi?.length || 0), 0);
            const berkasBertabel = siap.filter((s) => s.hasil.halamanBertabelTerdeteksi?.length).length;
            let pakaiOcr = false;
            if (totalTabel && openRouterKey) {
                const lanjutOcr = window.confirm(
                    `${banyak ? `${berkasBertabel} dari ${siap.length} berkas` : `"${siap[0].file.name}"`}: ` +
                    `${totalTabel} halaman tampak berupa tabel yang mungkin rusak dibaca pdf.js.\n\n` +
                    `Perbaiki dengan OCR (mistral-ocr)? Perkiraan biaya ±$${perkiraanOcr(totalTabel).toFixed(3)} ` +
                    `dari saldo OpenRouter Anda, di luar biaya embedding.`
                );
                // OCR massal (2026-09-16): buku Kepbup 1.004 halaman menandai 939 halaman bertabel —
                // ±$1,9 dan berjam-jam. Konfirmasi kedua menyebut lama pengerjaan sebelum uang terpakai.
                pakaiOcr = lanjutOcr && (totalTabel <= OCR_BANYAK_HALAMAN || window.confirm(
                    `${totalTabel} halaman itu banyak.\n\n` +
                    `Perkiraan: ±${perkiraanMenitOcr(totalTabel)} menit dan ±$${perkiraanOcr(totalTabel).toFixed(3)}, ` +
                    `dikirim ${OCR_SERENTAK} halaman sekaligus agar tidak kena batas laju.\n` +
                    `Halaman yang tetap gagal akan dilewati (teks biasa tetap dipakai), bukan membatalkan unggahan.\n` +
                    (banyak ? 'Biarkan aplikasi tetap terbuka sampai semua berkas selesai.\n' : '') +
                    `\nLanjutkan OCR?`
                ));
            }

            // 3. Biaya embedding — satu konfirmasi (perkiraan dari teks sebelum OCR).
            const totalPotongan = siap.reduce((a, s) => a + perkiraanUnggah(s.hasil.huruf).potongan, 0);
            if (totalPotongan > POTONGAN_PERLU_KONFIRMASI) {
                const totalDolar = siap.reduce((a, s) => a + perkiraanUnggah(s.hasil.huruf).dolar, 0);
                const totalHalaman = siap.reduce((a, s) => a + (s.hasil.halaman || 0), 0);
                const infoKosong = siap.reduce((a, s) => a + (s.hasil.halamanKosong || 0), 0);
                const lanjut = window.confirm(
                    `${banyak ? `${siap.length} berkas` : `"${siap[0].file.name}"`}: ` +
                    `${totalHalaman ? `${totalHalaman} halaman, ` : ''}±${totalPotongan} potongan teks.` +
                    `${infoKosong ? `\n${infoKosong} halaman berupa gambar dilewati.` : ''}\n\n` +
                    `Perkiraan biaya embedding ±$${totalDolar.toFixed(3)} dari saldo OpenRouter Anda. Lanjutkan?`
                );
                if (!lanjut) return;
            }

            const headers = {};
            if (openRouterKey) headers['x-byok-openrouter'] = openRouterKey.replace(/[^\x00-\x7F]/g, '');

            // 4. Proses berurutan: OCR (bila dipilih) → rag-process. Satu berkas gagal tidak menghentikan yang lain.
            for (const [i, item] of siap.entries()) {
                const { file } = item;
                let { hasil } = item;
                const awalan = banyak ? `Berkas ${i + 1}/${siap.length} · ` : '';
                try {
                    const halamanTabel = hasil.halamanBertabelTerdeteksi || [];
                    if (pakaiOcr && halamanTabel.length) {
                        setStatusUnggah(`${awalan}OCR ${halamanTabel.length} halaman tabel…`);
                        const { peta: petaOcr, halamanGagal } = await terapkanOcrHalaman(
                            new Uint8Array(await file.arrayBuffer()),
                            halamanTabel,
                            openRouterKey,
                            ({ ke, total, gagal }) => setStatusUnggah(`${awalan}OCR halaman ${ke}/${total}${gagal ? ` (${gagal} dilewati)` : ''}…`)
                        );
                        if (halamanGagal.length) {
                            console.warn(`[ResearchApp] OCR melewati ${halamanGagal.length} halaman di ${file.name}:`, halamanGagal.join(', '));
                            hasilAkhir.ocrDilewati.push({ nama: file.name, halaman: halamanGagal });
                        }
                        hasil = await ekstrakTeksDokumen(file, { petaOcrHalaman: petaOcr });
                    }

                    setStatusUnggah(`${awalan}Memvektorkan ±${perkiraanUnggah(hasil.huruf).potongan} potongan…`);
                    const { data, error } = await supabase.functions.invoke('rag-process', {
                        body: {
                            title: file.name,
                            text: hasil.teks,
                            userId: session.user.id,
                            // Hanya dikirim kalau pengguna memang sedang memilih sebuah space.
                            // Tanpa ini rag-process mencari space CORE milik pengguna sendiri.
                            ...(selectedSpace ? { spaceId: selectedSpace } : {}),
                            source_type: 'user_upload',
                            retrieved_at: new Date().toISOString()
                        },
                        headers
                    });

                    // Untuk status non-2xx supabase-js mengembalikan `error` bermesej umum
                    // ("Edge Function returned a non-2xx status code"); alasan sebenarnya ada di
                    // body jawaban, yang tersedia lewat error.context (Item 63).
                    if (error) {
                        let pesan = error.message;
                        try {
                            const isi = await error.context?.json?.();
                            if (isi?.error) pesan = isi.error;
                        } catch {
                            // Body bukan JSON — pakai pesan bawaan.
                        }
                        throw new Error(pesan);
                    }
                    if (data?.error) throw new Error(data.error);

                    console.log(`[ResearchApp] ✅ ${file.name}: ${data?.message ?? 'terunggah'} (${hasil.jenis}, ${hasil.huruf} huruf${data?.seconds ? `, ${data.seconds} s` : ''})`);
                    hasilAkhir.berhasil.push(file.name);
                } catch (err) {
                    console.error(`[ResearchApp] Gagal upload ${file.name}:`, err);
                    hasilAkhir.gagal.push({ nama: file.name, pesan: err.message });
                    // Saldo habis / kunci ditolak berlaku untuk semua berkas berikutnya → berhenti, jangan menagih ulang.
                    if (/\b(401|402)\b|SALDO_HABIS|KUNCI_TIDAK_VALID|OPENROUTER_KEY_REQUIRED/i.test(err.message)) {
                        siap.slice(i + 1).forEach((s) => hasilAkhir.gagal.push({ nama: s.file.name, pesan: 'tidak diproses — kunci/saldo OpenRouter bermasalah' }));
                        break;
                    }
                }
            }
        } catch (err) {
            console.error('[ResearchApp] Gagal upload:', err);
            hasilAkhir.gagal.push({ nama: banyak ? `(${files.length} berkas)` : files[0].name, pesan: err.message });
        } finally {
            setUploading(false);
            setStatusUnggah('');
            e.target.value = '';
            loadDocuments();

            const { berhasil, dilewati, gagal, ocrDilewati } = hasilAkhir;
            if (berhasil.length + dilewati.length + gagal.length > 0) {
                console.log('[ResearchApp] Ringkasan unggah:', { berhasil: berhasil.length, dilewati, gagal, ocrDilewati });
                const daftar = (arr, f) => arr.slice(0, 10).map(f).join('\n') + (arr.length > 10 ? `\n… dan ${arr.length - 10} lagi (lihat konsol)` : '');
                const baris = [];
                if (banyak || dilewati.length) baris.push(`Berhasil: ${berhasil.length} · Dilewati (judul sudah ada): ${dilewati.length} · Gagal: ${gagal.length}`);
                if (gagal.length) baris.push(`\nGagal:\n${daftar(gagal, (g) => `- ${g.nama}: ${g.pesan}`)}`);
                if (dilewati.length && banyak) baris.push(`\nDilewati:\n${daftar(dilewati, (n) => `- ${n}`)}`);
                if (!banyak && dilewati.length) baris.push('Dokumen berjudul sama sudah ada — hapus dulu bila ingin mengunggah ulang.');
                if (ocrDilewati.length) {
                    const jumlah = ocrDilewati.reduce((a, o) => a + o.halaman.length, 0);
                    baris.push(`\n${jumlah} halaman gagal di-OCR dan dilewati (teks biasa tetap dipakai):\n${daftar(ocrDilewati, (o) => `- ${o.nama}: hal ${o.halaman.join(', ')}`)}`);
                }
                // Ditunda sebentar: alert memblokir, dan tanpa jeda layar masih menampilkan status
                // "Berkas n/n · Memvektorkan…" serta daftar lama (uji 3 berkas 2026-09-17).
                if (baris.length) setTimeout(() => alert(baris.join('\n')), 300);
            }
        }
    };

    // Delete document
    const handleDelete = async (docId) => {
        if (deletingId) return;
        setDeletingId(docId);
        try {
            // supabase-js tidak melempar error — wajib cek { error } sendiri.
            // Hapus chunks dulu. Nol baris di sini wajar (dokumen bisa tanpa potongan).
            const { error: errChunks } = await supabase.from('document_chunks').delete().eq('document_id', docId);
            if (errChunks) throw errChunks;

            // Hapus dokumen dan minta baris yang terhapus dikembalikan:
            // DELETE yang tidak mengenai baris apa pun tetap 204 tanpa error,
            // jadi 0 baris = dokumen sudah tidak ada (daftar di layar basi).
            const { data, error } = await supabase.from('documents').delete().eq('id', docId).select('id');
            if (error) throw error;
            if (!data || data.length === 0) {
                alert('Dokumen tidak ditemukan di server — kemungkinan sudah dihapus sebelumnya atau daftar ini sudah usang. Daftar dokumen dimuat ulang, periksa kembali dokumen yang ingin dihapus.');
            }
        } catch (err) {
            console.error('[ResearchApp] Gagal menghapus:', err);
            alert('Gagal menghapus dokumen: ' + (err.message || err));
        } finally {
            setDeletingId(null);
            // Berhasil atau gagal, selalu muat ulang dari server agar entri basi hilang.
            loadDocuments();
        }
    };

    // Tampilkan jam juga: dua unggahan berjudul sama di hari yang sama
    // tidak bisa dibedakan bila hanya tanggal.
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleString('id-ID', {
            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <div className="h-full bg-slate-950 text-white p-6 overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-500/20 rounded-lg border border-blue-500/30">
                        <Database className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                            Research App
                        </h1>
                        <p className="text-xs text-slate-400">Knowledge Base Management</p>
                    </div>
                </div>

                {/* Upload Button */}
                <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg cursor-pointer transition-colors text-sm">
                    <Upload className="w-4 h-4" />
                    {uploading ? (statusUnggah || 'Mengunggah...') : 'Upload Dokumen'}
                    <input type="file" multiple className="hidden" onChange={handleUpload} accept={[ACCEPT_UNGGAH, ...EKSTENSI_EXCEL].join(',')} disabled={uploading} />
                </label>
            </div>

            {pratinjauTabel && (
                <PratinjauDataTabel
                    key={pratinjauTabel._unggahan}
                    hasil={pratinjauTabel}
                    onTutup={() => setPratinjauTabel(null)}
                    opdAwal={opdDariNamaBerkas(pratinjauTabel.berkas)}
                    onPeriksaVersi={async (opd) => {
                        const { p_pegawai } = siapkanSimpan(pratinjauTabel, opd);
                        return dugaVersi(p_pegawai.map((p) => p.nip), await ambilBerkasAktif(supabase), pratinjauTabel.berkas);
                    }}
                    onSimpan={async (opd, pilihan) => {
                        await simpanBerkasAsn(supabase, siapkanSimpan(pratinjauTabel, opd), pilihan);
                        await muatDaftarTabel();
                    }}
                />
            )}

            <DaftarDataTabel
                daftar={daftarTabel}
                onHapus={async (id) => {
                    try {
                        const n = await hapusBerkasAsn(supabase, id);
                        if (!n) alert('Data tabel tidak ditemukan di server — daftar dimuat ulang.');
                    } catch (err) {
                        alert('Gagal menghapus data tabel: ' + (err.message || err));
                    } finally {
                        await muatDaftarTabel();
                    }
                }}
            />

            {/* Search Bar */}
            <div className="mb-6">
                <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 focus-within:border-blue-500/50 transition-colors">
                    <Search className="w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Cari dokumen..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-500 focus:outline-none"
                    />
                </div>
            </div>

            {/* Knowledge Spaces */}
            {knowledgeSpaces.length > 0 && (
                <div className="mb-6 flex gap-2 flex-wrap">
                    {knowledgeSpaces.map(space => (
                        <button
                            key={space.id}
                            onClick={() => setSelectedSpace(space.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${selectedSpace === space.id
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                }`}
                        >
                            {space.name}
                        </button>
                    ))}
                </div>
            )}

            {/* Document List */}
            {loading ? (
                <div className="flex items-center justify-center py-12 text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Memuat dokumen...
                </div>
            ) : documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-600">
                    <FileText className="w-16 h-16 mb-4 opacity-50" />
                    <p className="text-sm">Belum ada dokumen</p>
                    <p className="text-xs mt-1">Upload dokumen untuk memulai research</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {documents.map(doc => (
                        <div
                            key={doc.id}
                            className="flex items-center justify-between bg-slate-900/50 border border-slate-800 rounded-lg p-4 hover:border-blue-500/30 transition-all"
                        >
                            <div className="flex items-center gap-3">
                                <FileText className="w-5 h-5 text-blue-400 shrink-0" />
                                <div>
                                    <p className="text-sm text-slate-200">{doc.title}</p>
                                    <p className="text-[10px] text-slate-500">{formatDate(doc.created_at)}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => handleDelete(doc.id)}
                                disabled={deletingId === doc.id}
                                className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-all"
                                title="Hapus dokumen"
                            >
                                {deletingId === doc.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Trash2 className="w-4 h-4" />
                                )}
                            </button>
                        </div>
                    ))}
                    {documents.length < totalDokumen && (
                        <div className="flex flex-col items-center gap-2 pt-2">
                            <p className="text-[11px] text-slate-500">
                                Menampilkan {documents.length} dari {totalDokumen} dokumen — dokumen lama juga bisa dicari lewat judul
                            </p>
                            <button
                                onClick={() => loadDocuments(true)}
                                disabled={memuatLagi}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-blue-300 border border-blue-500/30 hover:bg-blue-500/10 transition-all disabled:opacity-50"
                            >
                                {memuatLagi && <Loader2 className="w-3 h-3 animate-spin" />}
                                Muat {Math.min(DOKUMEN_PER_HALAMAN, totalDokumen - documents.length)} lagi
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Stats */}
            <div className="mt-6 text-center text-[10px] text-slate-600">
                {documents.length < totalDokumen ? `${documents.length} dari ${totalDokumen}` : documents.length} dokumen • {knowledgeSpaces.length} spaces
            </div>
        </div>
    );
}