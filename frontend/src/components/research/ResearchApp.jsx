import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabase';
import { kernel } from '../../core/runtime/Kernel';
import Ikon from '../Ikon';
import { ekstrakTeksDokumen, perkiraanUnggah, ACCEPT_UNGGAH } from '../../core/runtime/services/documentTextExtractor.js';
import { bacaBerkasExcelAsn, adalahExcel, EKSTENSI_EXCEL, unduhExcelJanggal } from '../../core/runtime/services/bacaExcelAsn.js';
import PratinjauDataTabel from './PratinjauDataTabel.jsx';
import DaftarDataTabel from './DaftarDataTabel.jsx';
import LaporanKejanggalan from './LaporanKejanggalan.jsx';
import DaftarWorkspace from './DaftarWorkspace.jsx';
import { pilihRuangAwal, ingatRuangTerpilih, ruangTerpilihTersimpan, buatRuang, gantiNamaRuang, hapusRuangKosong } from '../../core/runtime/services/ruangPengetahuan.js';
import { opdDariNamaBerkas, siapkanSimpan, dugaVersi, bandingkanIsi, uraiPerbedaan } from '../../core/runtime/services/dataTabelAsn.js';
import { ambilBerkasAktif, ambilPegawaiBerkas, simpanBerkasAsn, daftarBerkasAsn, hapusBerkasAsn, ambilBahanLaporan } from '../../core/runtime/services/dataTabelAsnDb.js';
import { perkiraanOcr, terapkanOcrHalaman, perkiraanMenitOcr, OCR_BANYAK_HALAMAN, OCR_SERENTAK } from '../../core/runtime/services/pdfOcrService.js';
import { unggahBertahap } from '../../core/runtime/services/unggahBertahap.js';
import { buatCacheOcr, sidikBerkas } from '../../core/runtime/services/cacheOcr.js';
import { hapusDokumenBanyak, buatPenjagaTerbaru, ringkasRuang } from '../../core/runtime/services/hapusDokumen.js';
import BilahPilihDokumen from './BilahPilihDokumen.jsx';
import { adalahPdf, perkiraanPdfAsn, bacaBerkasPdfAsn } from '../../core/runtime/services/bacaPdfAsn.js';
import { buatCadangan, periksaBerkasCadangan, namaBerkasCadangan } from '../../core/runtime/services/cadanganData.js';
import { angka, ukuranMB } from '../../core/runtime/services/formatAngka.js';

const POTONGAN_PERLU_KONFIRMASI = 150;
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
    const [pilihan, setPilihan] = useState(() => new Set());
    const [statusHapusBanyak, setStatusHapusBanyak] = useState('');
    const penjagaDaftar = useRef(buatPenjagaTerbaru());
    const [knowledgeSpaces, setKnowledgeSpaces] = useState([]);
    const [pratinjauTabel, setPratinjauTabel] = useState(null);
    const [daftarTabel, setDaftarTabel] = useState([]);
    const muatDaftarTabel = async () => {
        try { setDaftarTabel(await daftarBerkasAsn(supabase)); }
        catch (err) { console.error('[ResearchApp] Gagal memuat data tabel:', err); }
    };
    const [selectedSpace, setSelectedSpaceMentah] = useState(null);
    const setSelectedSpace = (id) => { setSelectedSpaceMentah(id); ingatRuangTerpilih(id); };

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
            setSelectedSpaceMentah((kini) => pilihRuangAwal(data || [], (data || []).some((s) => s.id === kini) ? kini : ruangTerpilihTersimpan()));
        } catch (err) {
            console.error('[ResearchApp] Gagal memuat spaces:', err);
        }
    };

    const loadDocuments = async (tambah = false) => {
        const dari = tambah ? documents.length : 0;
        const sampai = tambah ? dari + DOKUMEN_PER_HALAMAN : Math.max(documents.length, DOKUMEN_PER_HALAMAN);
        if (tambah) setMemuatLagi(true); else setLoading(true);
        const nomor = penjagaDaftar.current.mulai();
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            let query = supabase.from('documents').select('*', { count: 'exact' }).eq('user_id', session.user.id);
            if (selectedSpace && !searchQuery.trim()) {
                query = query.eq('space_id', selectedSpace);
            }
            if (searchQuery.trim()) {
                query = query.ilike('title', `%${searchQuery.trim()}%`);
            }

            const { data, error, count } = await query
                .order('created_at', { ascending: false }).order('id', { ascending: true })
                .range(dari, sampai - 1);
            if (error) throw error;
            if (!penjagaDaftar.current.masihTerbaru(nomor)) return;
            setDocuments((lama) => (tambah ? [...lama, ...(data || [])] : (data || [])));
            setTotalDokumen(count ?? 0);
        } catch (err) {
            console.error('[ResearchApp] Gagal memuat dokumen:', err);
        } finally {
            if (penjagaDaftar.current.masihTerbaru(nomor)) {
                setLoading(false);
                setMemuatLagi(false);
            }
        }
    };

    useEffect(() => {
        loadSpaces();
        muatDaftarTabel();
    }, []);

    useEffect(() => {
        setDocuments([]);
        setPilihan(new Set());
        loadDocuments();
    }, [selectedSpace, searchQuery]);

    const handleUpload = async (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;

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

            let openRouterKey = null;
            try {
                const vault = kernel.serviceManager?.get('VaultService');
                openRouterKey = vault?.getKey('openrouter') || null;
            } catch {
            }
            if (!openRouterKey) {
                alert('Kunci OpenRouter belum terpasang di aplikasi ini — unggahan dibatalkan sebelum membaca berkas.\n\n' +
                    'Pasang kunci di Pengaturan (kunci baru bila kunci lama sudah diganti), lalu unggah lagi.');
                return;
            }

            const { data: judulAda, error: errJudul } = await supabase
                .from('documents').select('title, selesai, space_id').eq('user_id', session.user.id).limit(10000);
            if (errJudul) throw errJudul;
            const sudahAda = new Set((judulAda || []).filter((d) => d.selesai !== false).map((d) => d.title));
            const tertunda = new Set((judulAda || []).filter((d) => d.selesai === false).map((d) => d.title));
            const diRuangIni = new Set((judulAda || [])
                .filter((d) => d.selesai !== false && (!selectedSpace || d.space_id === selectedSpace)).map((d) => d.title));
            const kembar = files.filter((f) => diRuangIni.has(f.name)).map((f) => f.name);
            const perbarui = kembar.length > 0 && window.confirm(
                `${kembar.length} berkas sudah ada di workspace ini:\n${kembar.slice(0, 10).map((n) => `- ${n}`).join('\n')}` +
                `${kembar.length > 10 ? `\n… dan ${kembar.length - 10} lagi` : ''}\n\n` +
                'OK = PERBARUI isinya: versi baru dibangun, bagian yang isinya sama tidak dibayar ulang, versi lama dihapus ' +
                'sesudah versi baru selesai (selama itu versi lama tetap dipakai chat).\nBatal = lewati berkas-berkas itu.'
            );

            const siap = [];
            for (const file of files) {
                const diperbarui = perbarui && diRuangIni.has(file.name);
                if (sudahAda.has(file.name) && !diperbarui) { hasilAkhir.dilewati.push(file.name); continue; }
                try {
                    setStatusUnggah(`Membaca ${namaBerkas(file)}…`);
                    const hasil = await ekstrakTeksDokumen(file, {
                        onProgress: ({ halaman, total }) => {
                            if (total) setStatusUnggah(`Membaca ${banyak ? `berkas ${files.indexOf(file) + 1}/${files.length}, ` : ''}halaman ${halaman}/${total}…`);
                        }
                    });
                    siap.push({ file, hasil, perbarui: diperbarui });
                } catch (err) {
                    hasilAkhir.gagal.push({ nama: file.name, pesan: err.message });
                }
            }

            const totalTabel = siap.reduce((a, s) => a + (s.hasil.halamanBertabelTerdeteksi?.length || 0), 0);
            const berkasBertabel = siap.filter((s) => s.hasil.halamanBertabelTerdeteksi?.length).length;
            let pakaiOcr = false;
            if (totalTabel && openRouterKey) {
                const lanjutOcr = window.confirm(
                    `${banyak ? `${berkasBertabel} dari ${siap.length} berkas` : `"${siap[0].file.name}"`}: ` +
                    `${totalTabel} halaman tampak berupa tabel yang mungkin rusak dibaca pdf.js.\n\n` +
                    `Perbaiki dengan OCR (mistral-ocr)? Perkiraan biaya ±${angka(perkiraanOcr(totalTabel), 3)} ` +
                    `dari saldo OpenRouter Anda, di luar biaya embedding.`
                );
                pakaiOcr = lanjutOcr && (totalTabel <= OCR_BANYAK_HALAMAN || window.confirm(
                    `${totalTabel} halaman itu banyak.\n\n` +
                    `Perkiraan: ±${perkiraanMenitOcr(totalTabel)} menit dan ±${angka(perkiraanOcr(totalTabel), 3)}, ` +
                    `dikirim ${OCR_SERENTAK} halaman sekaligus agar tidak kena batas laju.\n` +
                    `Halaman yang tetap gagal akan dilewati (teks biasa tetap dipakai), bukan membatalkan unggahan.\n` +
                    (banyak ? 'Biarkan aplikasi tetap terbuka sampai semua berkas selesai.\n' : '') +
                    `\nLanjutkan OCR?`
                ));
            }

            const totalPotongan = siap.reduce((a, s) => a + perkiraanUnggah(s.hasil.huruf).potongan, 0);
            if (totalPotongan > POTONGAN_PERLU_KONFIRMASI) {
                const totalDolar = siap.reduce((a, s) => a + perkiraanUnggah(s.hasil.huruf).dolar, 0);
                const totalHalaman = siap.reduce((a, s) => a + (s.hasil.halaman || 0), 0);
                const infoKosong = siap.reduce((a, s) => a + (s.hasil.halamanKosong || 0), 0);
                const nLanjut = siap.filter((s) => tertunda.has(s.file.name) || s.perbarui).length;
                const lanjut = window.confirm(
                    `${banyak ? `${siap.length} berkas` : `"${siap[0].file.name}"`}: ` +
                    `${totalHalaman ? `${totalHalaman} halaman, ` : ''}±${totalPotongan} potongan teks.` +
                    `${infoKosong ? `\n${infoKosong} halaman berupa gambar dilewati.` : ''}\n\n` +
                    `Perkiraan biaya embedding ±${angka(totalDolar, 3)} dari saldo OpenRouter Anda.` +
                    (nLanjut ? `\n${banyak ? `${nLanjut} berkas melanjutkan` : 'Ini melanjutkan'} unggahan yang belum selesai atau memperbarui dokumen lama — potongan yang sudah tersimpan tidak dibayar lagi, jadi biaya sebenarnya lebih kecil.` : '') +
                    ` Lanjutkan?`
                );
                if (!lanjut) return;
            }

            const headers = {};
            if (openRouterKey) headers['x-byok-openrouter'] = openRouterKey.replace(/[^\x00-\x7F]/g, '');

            for (const [i, item] of siap.entries()) {
                const { file } = item;
                let { hasil } = item;
                const awalan = banyak ? `Berkas ${i + 1}/${siap.length} · ` : '';
                try {
                    const halamanTabel = hasil.halamanBertabelTerdeteksi || [];
                    if (pakaiOcr && halamanTabel.length) {
                        setStatusUnggah(`${awalan}OCR ${halamanTabel.length} halaman tabel…`);
                        const bytes = new Uint8Array(await file.arrayBuffer());
                        const cache = buatCacheOcr(await sidikBerkas(bytes));
                        const { peta: petaOcr, halamanGagal, saldoHabis, halamanBelum = [] } = await terapkanOcrHalaman(
                            bytes,
                            halamanTabel,
                            openRouterKey,
                            ({ ke, total, gagal, dariCache }) => setStatusUnggah(`${awalan}OCR halaman ${ke}/${total}${dariCache ? ` (${dariCache} dari cache)` : ''}${gagal ? ` (${gagal} dilewati)` : ''}…`),
                            { cache }
                        );
                        if (saldoHabis) {
                            const lanjutTanpaOcr = window.confirm(
                                `OCR "${file.name}" berhenti: saldo OpenRouter tidak cukup (OCR berkas butuh saldo minimal $0,50).\n\n` +
                                `${halamanBelum.length} dari ${halamanTabel.length} halaman tabel belum di-OCR; yang sudah di-OCR tersimpan ` +
                                'di cache dan tidak dibayar ulang.\n\n' +
                                'OK = lanjut unggah TANPA OCR untuk halaman itu (tabelnya dibaca pdf.js, mutunya lebih rendah).\n' +
                                'Batal = hentikan unggahan; isi saldo, lalu unggah lagi.'
                            );
                            if (!lanjutTanpaOcr) {
                                throw Object.assign(new Error('Dihentikan: saldo OpenRouter tidak cukup untuk OCR. Isi saldo, lalu unggah lagi — halaman yang sudah di-OCR tidak dibayar ulang.'), { status: 402 });
                            }
                            hasilAkhir.ocrDilewati.push({ nama: file.name, halaman: halamanBelum });
                        }
                        if (halamanGagal.length) {
                            console.warn(`[ResearchApp] OCR melewati ${halamanGagal.length} halaman di ${file.name}:`, halamanGagal.join(', '));
                            hasilAkhir.ocrDilewati.push({ nama: file.name, halaman: halamanGagal });
                        }
                        hasil = await ekstrakTeksDokumen(file, { petaOcrHalaman: petaOcr });
                    }

                    setStatusUnggah(`${awalan}Memvektorkan ±${perkiraanUnggah(hasil.huruf).potongan} potongan…`);
                    const body = {
                        title: file.name,
                        text: hasil.teks,
                        userId: session.user.id,
                        ...(selectedSpace ? { spaceId: selectedSpace } : {}),
                        source_type: 'user_upload',
                        retrieved_at: new Date().toISOString(),
                        ...(item.perbarui ? { perbarui: true } : {})
                    };
                    const data = await unggahBertahap({
                        panggil: () => supabase.functions.invoke('rag-process', { body, headers }),
                        onKemajuan: ({ tersimpan, total, ulang, menunggu }) => {
                            if (menunggu) setStatusUnggah(`${awalan}Menunggu proses sebelumnya selesai (${menunggu})…`);
                            else if (total) setStatusUnggah(`${awalan}Memvektorkan ${tersimpan}/${total} potongan${ulang ? ` — mencoba lagi (${ulang})` : ''}…`);
                        }
                    });

                    console.log(`[ResearchApp] ✅ ${file.name}: ${data?.message ?? 'terunggah'} (${hasil.jenis}, ${hasil.huruf} huruf${data?.seconds ? `, ${data.seconds} s` : ''})`);
                    hasilAkhir.berhasil.push(data?.sama ? `${file.name} (isinya sama persis — tidak diubah)`
                        : data?.diperbarui ? `${file.name} (diperbarui${data.disalin ? `, ${data.disalin} potongan tak berubah` : ''})` : file.name);
                } catch (err) {
                    console.error(`[ResearchApp] Gagal upload ${file.name}:`, err);
                    hasilAkhir.gagal.push({ nama: file.name, pesan: err.message });
                    if (err.status === 401 || err.status === 402 || /\b(401|402)\b|SALDO_HABIS|KUNCI_TIDAK_VALID|OPENROUTER_KEY_REQUIRED/i.test(err.message)) {
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
                if (baris.length) setTimeout(() => alert(baris.join('\n')), 300);
            }
        }
    };

    const handlePdfDataTabel = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (!adalahPdf(file.name)) { alert('Pilih berkas PDF. Excel diunggah lewat "Upload Dokumen".'); return; }
        let kunci = null;
        try { kunci = kernel.serviceManager?.get('VaultService')?.getKey('openrouter') || null; } catch {  }
        if (!kunci) {
            alert('Kunci OpenRouter belum terpasang — OCR PDF dibayar dari saldo OpenRouter Anda. Pasang kunci di Pengaturan, lalu coba lagi.');
            return;
        }
        setUploading(true);
        setStatusUnggah('Menghitung halaman PDF…');
        try {
            const p = await perkiraanPdfAsn(file);
            const lanjut = window.confirm(
                `"${file.name}": ${p.halaman} halaman.\n\n` +
                `Semua halaman dibaca dengan OCR (mistral-ocr): perkiraan ±${angka(p.dolar, 3)} dari saldo OpenRouter Anda, ` +
                `±${perkiraanMenitOcr(p.halaman)} menit.\n\n` +
                'Hasilnya tampil sebagai pratinjau Data Tabel — belum disimpan sampai Anda menekan Simpan. Lanjutkan?'
            );
            if (!lanjut) return;
            const hasil = await bacaBerkasPdfAsn(file, p, kunci, ({ ke, total, gagal }) =>
                setStatusUnggah(`OCR halaman ${ke}/${total}${gagal ? ` (${gagal} gagal)` : ''}…`));
            setPratinjauTabel({ ...hasil, _unggahan: `${Date.now()}-${Math.random()}` });
        } catch (err) {
            console.error('[ResearchApp] Gagal membaca PDF data tabel:', err);
            alert(`Gagal membaca ${file.name}: ${err.message || err}`);
        } finally {
            setUploading(false);
            setStatusUnggah('');
        }
    };

    const handleCadangan = async () => {
        const lanjut = window.confirm(
            'Cadangkan semua data Anda ke satu berkas di laptop ini?\n\n' +
            'Isi: workspace, dokumen + teks & vektor RAG, Data Tabel ASN, chat, memori, pemakaian API. ' +
            'Log sistem tidak ikut. Ukuran ±40 MB.\n\n' +
            'Berkas berisi DATA PRIBADI (nama & NIP ASN, memori, chat) — simpan di tempat aman.\n\nLanjutkan?'
        );
        if (!lanjut) return;
        setUploading(true);
        setStatusUnggah('Menyiapkan cadangan…');
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { alert('Sesi tidak ditemukan. Silakan masuk kembali.'); return; }
            const sekarang = new Date();
            const { berkas, ringkas } = await buatCadangan(supabase, {
                userId: session.user.id,
                sekarang,
                onKemajuan: ({ tabel, ke, total, baris }) => setStatusUnggah(`Cadangan ${ke}/${total}: ${tabel}${baris ? ` (${baris})` : ''}…`),
            });
            const teks = JSON.stringify(berkas);
            const cek = periksaBerkasCadangan(JSON.parse(teks));
            const url = URL.createObjectURL(new Blob([teks], { type: 'application/json' }));
            const a = document.createElement('a');
            a.href = url;
            a.download = namaBerkasCadangan(sekarang);
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 60000);
            const mb = ukuranMB(teks.length);
            const baris = ringkas.tabel.map((t) => `${t.cocok ? '✓' : '✗'} ${t.nama}: ${t.berkas}${t.cocok ? '' : ` (database ${t.db})`}`).join('\n');
            alert(
                (cek.sah ? '✓ Cadangan lengkap — semua tabel cocok dengan database.' : `✗ Cadangan TIDAK lengkap:\n${cek.masalah.join('\n')}`) +
                `\n\n${a.download} · ${mb} MB\n\n${baris}`
            );
        } catch (err) {
            console.error('[ResearchApp] Gagal membuat cadangan:', err);
            alert(`Gagal membuat cadangan — tidak ada berkas yang ditulis.\n\n${err.message || err}`);
        } finally {
            setUploading(false);
            setStatusUnggah('');
        }
    };

    const handleDelete = async (docId) => {
        if (deletingId) return;
        setDeletingId(docId);
        try {
            const { error: errChunks } = await supabase.from('document_chunks').delete().eq('document_id', docId);
            if (errChunks) throw errChunks;

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
            loadDocuments();
        }
    };

    const togglePilih = (id) => setPilihan((lama) => {
        const baru = new Set(lama);
        if (baru.has(id)) baru.delete(id); else baru.add(id);
        return baru;
    });
    const pilihSemuaTampil = () => setPilihan((lama) =>
        (documents.length > 0 && documents.every((d) => lama.has(d.id)) ? new Set() : new Set(documents.map((d) => d.id))));
    const hapusTerpilih = async () => {
        const target = documents.filter((d) => pilihan.has(d.id));
        if (!target.length || statusHapusBanyak) return;
        const contoh = target.slice(0, 10).map((d) => `- ${d.title}`).join('\n') + (target.length > 10 ? `\n… dan ${target.length - 10} lagi` : '');
        const lanjut = window.confirm(
            `Hapus ${target.length} dokumen beserta SEMUA potongannya?\n\n` +
            `Dari workspace: ${ringkasRuang(target, knowledgeSpaces)}\n\n${contoh}\n\n` +
            'Tidak bisa dibatalkan.'
        );
        if (!lanjut) return;
        setStatusHapusBanyak(`Menghapus 0/${target.length}…`);
        try {
            const h = await hapusDokumenBanyak(supabase, target.map((d) => d.id), {
                onKemajuan: ({ selesai, total }) => setStatusHapusBanyak(`Menghapus ${selesai}/${total}…`)
            });
            const catatan = [];
            if (h.gagal) catatan.push(`Berhenti sesudah ${h.dihapus.length} dari ${target.length} dokumen terhapus: ${h.gagal.pesan}`);
            if (h.tidakDitemukan.length) catatan.push(`${h.tidakDitemukan.length} dokumen sudah tidak ada di server (daftar basi) — dilewati.`);
            if (catatan.length) alert(catatan.join('\n\n'));
            console.log(`[ResearchApp] Hapus terpilih: ${h.dihapus.length} terhapus, ${h.tidakDitemukan.length} tak ditemukan${h.gagal ? ', berhenti karena galat' : ''}`);
        } catch (err) {
            console.error('[ResearchApp] Gagal menghapus terpilih:', err);
            alert('Gagal menghapus dokumen terpilih: ' + (err.message || err));
        } finally {
            setStatusHapusBanyak('');
            setPilihan(new Set());
            loadDocuments();
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleString('id-ID', {
            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <div className="h-full text-white p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-500/20 rounded-lg border border-blue-500/30">
                        <Ikon nama="database" ukuran={24} className="text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                            Research App
                        </h1>
                        <p className="text-xs text-slate-400">Knowledge Base Management</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                <button
                    onClick={handleCadangan}
                    disabled={uploading}
                    className="flex items-center gap-2 px-3 py-2 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10 rounded-lg transition-colors text-sm disabled:opacity-50"
                    title="Unduh cadangan lengkap data Anda (Item 93)"
                >
                    <Ikon nama="download_for_offline" ukuran={16} />
                    Cadangkan data
                </button>
                <label className="flex items-center gap-2 px-3 py-2 border border-amber-500/40 text-amber-200 hover:bg-amber-500/10 rounded-lg cursor-pointer transition-colors text-sm" title="Berkas rekonsiliasi ASN hasil pindaian (PDF) → Data Tabel, lewat OCR">
                    <Ikon nama="document_scanner" ukuran={16} />
                    PDF → Data Tabel
                    <input type="file" className="hidden" onChange={handlePdfDataTabel} accept=".pdf" disabled={uploading} />
                </label>
                <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg cursor-pointer transition-colors text-sm">
                    <Ikon nama="upload" ukuran={16} />
                    {uploading ? (statusUnggah || 'Mengunggah...') : 'Upload Dokumen'}
                    <input type="file" multiple className="hidden" onChange={handleUpload} accept={[ACCEPT_UNGGAH, ...EKSTENSI_EXCEL].join(',')} disabled={uploading} />
                </label>
                </div>
            </div>

            {pratinjauTabel && (
                <PratinjauDataTabel
                    key={pratinjauTabel._unggahan}
                    hasil={pratinjauTabel}
                    onTutup={() => setPratinjauTabel(null)}
                    opdAwal={opdDariNamaBerkas(pratinjauTabel.berkas)}
                    onPeriksaVersi={async (opd) => {
                        const { p_pegawai } = siapkanSimpan(pratinjauTabel, opd);
                        const kandidat = dugaVersi(p_pegawai.map((p) => p.nip), await ambilBerkasAktif(supabase), pratinjauTabel.berkas);
                        for (const k of kandidat) {
                            const b = bandingkanIsi(p_pegawai, await ambilPegawaiBerkas(supabase, k.id));
                            k.identik = b.identik;
                            k.perbedaan = uraiPerbedaan(b);
                        }
                        return kandidat;
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

            {daftarTabel.some((b) => !b.digantikan_oleh) && (
                <LaporanKejanggalan
                    key={daftarTabel.map((b) => `${b.id}:${b.digantikan_oleh || ''}`).join(',')}
                    onMuatBahan={() => ambilBahanLaporan(supabase)}
                    onUnduh={unduhExcelJanggal}
                />
            )}

            <div className="mb-6">
                <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 focus-within:border-blue-500/50 transition-colors">
                    <Ikon nama="search" ukuran={16} className="text-slate-500" />
                    <input
                        type="text"
                        placeholder="Cari dokumen..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-500 focus:outline-none"
                    />
                </div>
            </div>

            <DaftarWorkspace
                daftar={knowledgeSpaces}
                terpilih={selectedSpace}
                onPilih={setSelectedSpace}
                jumlahDokumen={searchQuery.trim() || loading ? null : totalDokumen}
                onBuat={async (nama) => {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session) throw new Error('Sesi tidak ditemukan. Silakan masuk kembali.');
                    const baru = await buatRuang(supabase, session.user.id, nama);
                    setSelectedSpace(baru.id);
                    await loadSpaces();
                }}
                onGantiNama={async (id, nama) => {
                    try { await gantiNamaRuang(supabase, id, nama); }
                    finally { await loadSpaces(); }
                }}
                onHapus={async (ruang) => {
                    try { await hapusRuangKosong(supabase, ruang); }
                    finally { await loadSpaces(); }
                }}
            />

            {loading ? (
                <div className="flex items-center justify-center py-12 text-slate-500">
                    <Ikon nama="progress_activity" ukuran={20} className="animate-spin mr-2" />
                    Memuat dokumen...
                </div>
            ) : documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-600">
                    <Ikon nama="description" ukuran={64} className="mb-4 opacity-50" />
                    <p className="text-sm">Belum ada dokumen</p>
                    <p className="text-xs mt-1">Upload dokumen untuk memulai research</p>
                </div>
            ) : (
                <div className="space-y-2">
                    <BilahPilihDokumen
                        jumlahTampil={documents.length}
                        jumlahDipilih={documents.filter((d) => pilihan.has(d.id)).length}
                        onPilihSemua={pilihSemuaTampil}
                        onBatal={() => setPilihan(new Set())}
                        onHapus={hapusTerpilih}
                        status={statusHapusBanyak}
                    />
                    {documents.map(doc => (
                        <div
                            key={doc.id}
                            className={`flex items-center justify-between bg-slate-900/50 border rounded-lg p-4 hover:border-blue-500/30 transition-all ${pilihan.has(doc.id) ? 'border-blue-500/60' : 'border-slate-800'}`}
                        >
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={pilihan.has(doc.id)}
                                    onChange={() => togglePilih(doc.id)}
                                    disabled={!!statusHapusBanyak}
                                    aria-label={`Pilih ${doc.title}`}
                                    className="w-4 h-4 shrink-0 cursor-pointer accent-blue-500"
                                />
                                <Ikon nama="description" ukuran={20} className="text-blue-400 shrink-0" />
                                <div>
                                    <p className="text-sm text-slate-200">{doc.title}</p>
                                    <p className="text-[12px] text-slate-500">{formatDate(doc.created_at)}</p>
                                    {doc.selesai === false && (
                                        <p className="text-[12px] text-amber-400">
                                            Belum selesai{doc.total_potongan ? ` (${doc.total_potongan} potongan)` : ''} — belum dipakai chat. Unggah berkas yang sama untuk melanjutkan, atau hapus.
                                        </p>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => handleDelete(doc.id)}
                                disabled={deletingId === doc.id}
                                className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-all"
                                title="Hapus dokumen"
                            >
                                {deletingId === doc.id ? (
                                    <Ikon nama="progress_activity" ukuran={16} className="animate-spin" />
                                ) : (
                                    <Ikon nama="delete" ukuran={16} />
                                )}
                            </button>
                        </div>
                    ))}
                    {documents.length < totalDokumen && (
                        <div className="flex flex-col items-center gap-2 pt-2">
                            <p className="text-[12px] text-slate-500">
                                Menampilkan {documents.length} dari {totalDokumen} dokumen — dokumen lama juga bisa dicari lewat judul
                            </p>
                            <button
                                onClick={() => loadDocuments(true)}
                                disabled={memuatLagi}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-blue-300 border border-blue-500/30 hover:bg-blue-500/10 transition-all disabled:opacity-50"
                            >
                                {memuatLagi && <Ikon nama="progress_activity" ukuran={12} className="animate-spin" />}
                                Muat {Math.min(DOKUMEN_PER_HALAMAN, totalDokumen - documents.length)} lagi
                            </button>
                        </div>
                    )}
                </div>
            )}

            <div className="mt-6 text-center text-[12px] text-slate-600">
                {documents.length < totalDokumen ? `${documents.length} dari ${totalDokumen}` : documents.length} dokumen • {knowledgeSpaces.length} spaces
            </div>
        </div>
    );
}