import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { kernel } from '../../core/runtime/Kernel';
import { Search, Upload, Trash2, FileText, Loader2, Database, PlusCircle } from 'lucide-react';
import { ekstrakTeksDokumen, perkiraanUnggah, ACCEPT_UNGGAH } from '../../core/runtime/services/documentTextExtractor.js';

// Di atas ini pengguna diminta konfirmasi dulu — embedding dibayar dari saldo OpenRouter-nya.
const POTONGAN_PERLU_KONFIRMASI = 150; // ±105 ribu huruf ≈ $0,006 (potongan 800 huruf, Item 70)

export default function ResearchApp() {
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState(() => {
        return sessionStorage.getItem('research_search_query') || '';
    });
    const [uploading, setUploading] = useState(false);
    const [statusUnggah, setStatusUnggah] = useState('');
    const [deletingId, setDeletingId] = useState(null);
    const [knowledgeSpaces, setKnowledgeSpaces] = useState([]);
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
    const loadDocuments = async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            let query = supabase.from('documents').select('*').eq('user_id', session.user.id);
            // Jika ada query pencarian khusus, jangan batasi ke space tertentu agar dokumen selalu ditemukan
            if (selectedSpace && !searchQuery.trim()) {
                query = query.eq('space_id', selectedSpace);
            }
            if (searchQuery.trim()) {
                query = query.ilike('title', `%${searchQuery.trim()}%`);
            }

            const { data, error } = await query.order('created_at', { ascending: false }).limit(50);
            if (error) throw error;
            setDocuments(data || []);
        } catch (err) {
            console.error('[ResearchApp] Gagal memuat dokumen:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSpaces();
    }, []);

    useEffect(() => {
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
    const handleUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                alert('Sesi tidak ditemukan. Silakan masuk kembali.');
                return;
            }

            // PDF/DOCX diambil teksnya di browser (Item 69); berkas teks dibaca apa adanya.
            // Gagal (scan, terkunci, format lama…) melempar GagalEkstrak berpesan jelas → alert di bawah.
            setStatusUnggah('Membaca dokumen…');
            const hasil = await ekstrakTeksDokumen(file, {
                onProgress: ({ halaman, total }) => {
                    if (total) setStatusUnggah(`Membaca halaman ${halaman}/${total}…`);
                }
            });
            const text = hasil.teks;
            const { potongan, dolar } = perkiraanUnggah(hasil.huruf);
            if (potongan > POTONGAN_PERLU_KONFIRMASI) {
                const infoHalaman = hasil.halaman ? `${hasil.halaman} halaman, ` : '';
                const infoKosong = hasil.halamanKosong ? `\n${hasil.halamanKosong} halaman berupa gambar dilewati.` : '';
                const lanjut = window.confirm(
                    `"${file.name}": ${infoHalaman}±${potongan} potongan teks.${infoKosong}\n\n` +
                    `Perkiraan biaya embedding ±$${dolar.toFixed(3)} dari saldo OpenRouter Anda. Lanjutkan?`
                );
                if (!lanjut) return;
            }
            setStatusUnggah(`Memvektorkan ±${potongan} potongan…`);

            // Embedding dibayar pengguna dengan kunci OpenRouter-nya sendiri (Item 63).
            // Tanpa kunci, rag-process menolak dengan pesan yang menjelaskan caranya.
            const headers = {};
            try {
                const vault = kernel.serviceManager?.get('VaultService');
                const openRouterKey = vault?.getKey('openrouter');
                if (openRouterKey) headers['x-byok-openrouter'] = openRouterKey.replace(/[^\x00-\x7F]/g, '');
            } catch {
                // Vault belum siap — rag-process akan menjawab OPENROUTER_KEY_REQUIRED.
            }

            const { data, error } = await supabase.functions.invoke('rag-process', {
                body: {
                    title: file.name,
                    text,
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
            loadDocuments();
        } catch (err) {
            console.error('[ResearchApp] Gagal upload:', err);
            alert('Gagal mengunggah dokumen: ' + err.message);
        } finally {
            setUploading(false);
            setStatusUnggah('');
            e.target.value = '';
        }
    };

    // Delete document
    const handleDelete = async (docId) => {
        if (deletingId) return;
        setDeletingId(docId);
        try {
            // Hapus chunks dulu
            await supabase.from('document_chunks').delete().eq('document_id', docId);
            // Hapus dokumen
            await supabase.from('documents').delete().eq('id', docId);
            setDocuments(prev => prev.filter(d => d.id !== docId));
        } catch (err) {
            console.error('[ResearchApp] Gagal menghapus:', err);
        } finally {
            setDeletingId(null);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
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
                    <input type="file" className="hidden" onChange={handleUpload} accept={ACCEPT_UNGGAH} disabled={uploading} />
                </label>
            </div>

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
                </div>
            )}

            {/* Stats */}
            <div className="mt-6 text-center text-[10px] text-slate-600">
                {documents.length} dokumen • {knowledgeSpaces.length} spaces
            </div>
        </div>
    );
}