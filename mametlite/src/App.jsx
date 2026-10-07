import React, { useState, useEffect, useRef } from 'react';
import { Search, Upload, Send, User, Bot, Loader2, LogOut, Globe, BookOpen, Lock, Plus, MessageSquare, Trash2, Copy, Check, Settings, KeyRound, Menu, X } from 'lucide-react';
import { supabase } from './lib/supabase';
import { callAgentSimple, parseSSEStream } from './lib/callAgentSimple';
import { ekstrakTeksDokumen, perkiraanUnggah, ACCEPT_UNGGAH } from './lib/documentTextExtractor';
import { perkiraanOcr, terapkanOcrHalaman, perkiraanMenitOcr, OCR_BANYAK_HALAMAN, OCR_SERENTAK } from './lib/pdfOcrService';
import { pisahLabel, warnaLabel, teksSalinan } from './lib/labelRamah';
import TeksKaya from './lib/TeksKaya';
import { bacaRiwayat, simpanRiwayat, riwayatBaru } from './lib/riwayatLokal';
import { pesanUntukPengguna, pesanGalatMasuk } from './lib/pesanGalat';

// Di atas ini pengguna diminta konfirmasi dulu — embedding dibayar dari saldo OpenRouter-nya.
const POTONGAN_PERLU_KONFIRMASI = 150; // ±105 ribu huruf ≈ $0,006 (potongan 800 huruf, Item 70)

// Kunci OpenRouter pengguna. Mametlite MEMBACA localStorage 'x-byok-openrouter' di tiga tempat (chat,
// unggah, OCR) tetapi dulu tak punya tempat mengisinya — pesan galatnya menyuruh "buka Pengaturan"
// yang tidak ada, jadi chat & unggah selalu ditolak server dengan NO_API_KEY (U8 Item 90, 2026-09-21).
const KUNCI_OPENROUTER = 'x-byok-openrouter';
const bacaKunci = () => (localStorage.getItem(KUNCI_OPENROUTER) || '').trim();

// Teks model dirender oleh `lib/TeksKaya.jsx` sebagai elemen React — BUKAN string HTML yang
// disuntikkan. Sampai 7 Okt 2026 berkas ini membangun HTML lalu memakai `dangerouslySetInnerHTML`,
// dan pelolosannya memakai daftar putih tag yang alternatif `a`-nya hanya SATU HURUF, sehingga
// `<audio src=x onerror=…>` lolos beserta atributnya. Alasan lengkap & penjaganya ada di berkas itu
// dan di `uji/uji-uraian-markdown.mjs`.

const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    // Yang disalin harus sama dengan yang dibaca di layar — termasuk peringatannya. Lihat teksSalinan().
    navigator.clipboard.writeText(teksSalinan(text));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="text-slate-400 hover:text-emerald-400 transition-colors p-1.5 rounded hover:bg-slate-700/80 cursor-pointer flex items-center justify-center" title="Salin Jawaban AI">
      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
    </button>
  );
};

/**
 * Jawaban AI beserta labelnya dalam bahasa yang dimengerti pengguna awam (2026-09-29).
 *
 * Labelnya diletakkan DI ATAS jawaban, bukan di bawah seperti tulisan server: pembaca perlu tahu
 * cara membaca jawaban sebelum membacanya, bukan sesudah terlanjur mempercayainya.
 *
 * Penjelasannya selalu terlihat, tidak disembunyikan di balik hover — pengguna Mametlite membuka
 * dari HP, dan di layar sentuh tooltip tidak pernah muncul.
 *
 * Saat jawaban masih mengalir, labelnya belum ada (server menulisnya di akhir) → tidak ada yang
 * ditampilkan. Itu benar: lebih baik belum ada label daripada label yang berubah di tengah jalan.
 */
const JawabanBerlabel = ({ teks }) => {
  const { label, jawaban, catatan } = pisahLabel(teks);
  const warna = label ? warnaLabel(label.nada) : null;
  return (
    <div className="mt-4">
      {label && (
        <div className={`mb-3 rounded-lg border px-3 py-2 ${warna.bingkai}`}>
          <div className={`text-xs font-semibold ${warna.teks}`}>{label.judul}</div>
          <div className="text-xs text-slate-400 mt-0.5 leading-snug">{label.penjelasan}</div>
        </div>
      )}
      <TeksKaya teks={jawaban} className="text-sm leading-relaxed" />
      {catatan.map((c, i) => (
        <div key={i} className="mt-3 text-xs text-slate-500 italic border-l-2 border-slate-700 pl-3">{c}</div>
      ))}
    </div>
  );
};

function App() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(true);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [statusUnggah, setStatusUnggah] = useState('');
  const [documents, setDocuments] = useState([]);
  const [activeModes, setActiveModes] = useState({ rag: true, websearch: false, research: false });

  // Pengaturan kunci: hanya panjang kunci yang disimpan di state layar, bukan isinya.
  const [panelPengaturan, setPanelPengaturan] = useState(false);
  // Laci bilah sisi di layar kecil (M3). Tertutup saat dibuka — di `md` ke atas nilainya tidak
  // berpengaruh, karena bilah sisinya menetap di sana.
  const [laciTerbuka, setLaciTerbuka] = useState(false);
  const [galatMasuk, setGalatMasuk] = useState(null);
  const [kunciTerpasang, setKunciTerpasang] = useState(() => bacaKunci().length > 0);
  const [isianKunci, setIsianKunci] = useState('');

  // Riwayat chat — satu pintu di `lib/riwayatLokal.js` (M2, 2026-10-08).
  //
  // Dulu `JSON.parse(localStorage…)` dipanggil di sini TANPA `try`, di dalam inisialisator `useState`:
  // satu nilai rusak = layar putih, dan karena nilai buruknya tetap tersimpan, layar putih itu kembali
  // setiap muat ulang. Sekarang pembacaannya selalu memulangkan riwayat yang sah DAN menyebutkan
  // masalahnya bila ada — "tidak bisa dibaca" tidak boleh terlihat sama dengan "tidak ada".
  const [awalRiwayat] = useState(bacaRiwayat);
  const [conversations, setConversations] = useState(awalRiwayat.riwayat);
  const [masalahRiwayat, setMasalahRiwayat] = useState(awalRiwayat.masalah);
  const [currentConvId, setCurrentConvId] = useState(() => awalRiwayat.riwayat[0]?.id || 1);

  const currentConversation = conversations.find(c => c.id === currentConvId) || conversations[0];
  const messages = currentConversation?.messages || [];

  // Dulu SELURUH array percakapan ditulis ulang ke localStorage pada SETIAP token SSE (updateMessages
  // dipanggil per potongan arus), jadi satu jawaban RAG panjang menulis ratusan kali dan mendekati
  // batas ±5 MB dengan cepat. Sekarang penulisannya menunggu arusnya tenang 500 ms.
  useEffect(() => {
    const tunda = setTimeout(() => {
      const { masalah } = simpanRiwayat(conversations);
      if (masalah) setMasalahRiwayat(masalah);
    }, 500);
    return () => clearTimeout(tunda);
  }, [conversations]);

  // Penundaan di atas berarti arus yang terputus tepat sebelum halaman ditutup bisa hilang — jadi
  // disimpan sekali lagi saat halaman ditinggalkan. `pagehide` dipakai, bukan `beforeunload`: di
  // Safari iOS `beforeunload` sering tidak menyala sama sekali, dan penggunanya ada di HP.
  useEffect(() => {
    const simpanSekarang = () => simpanRiwayat(conversations);
    window.addEventListener('pagehide', simpanSekarang);
    return () => window.removeEventListener('pagehide', simpanSekarang);
  }, [conversations]);

  const updateMessages = (updater) => {
    setConversations(prev => prev.map(c => {
      if (c.id === currentConvId) {
        const updatedMsgs = typeof updater === 'function' ? updater(c.messages) : updater;
        let newTitle = c.title;
        // Auto-generate title based on first user message
        if (c.title === 'Percakapan Baru' && updatedMsgs.length > 1 && updatedMsgs[1].role === 'user') {
          newTitle = updatedMsgs[1].content.substring(0, 25) + '...';
        }
        return { ...c, title: newTitle, messages: updatedMsgs };
      }
      return c;
    }));
  };

  const toggleMode = (mode) => {
    setActiveModes(prev => ({ ...prev, [mode]: !prev[mode] }));
  };

  const handleNewChat = () => {
    const newId = Date.now();
    const newConv = { id: newId, title: 'Percakapan Baru', messages: [{ role: 'assistant', content: 'Halo! Saya **Mamet Lite**. Anda bisa mencari data di database internal (RAG), atau mengaktifkan fitur pencarian Web di bawah.' }] };
    setConversations(prev => [newConv, ...prev]);
    setCurrentConvId(newId);
    setLaciTerbuka(false); // di HP lacinya menutupi chat; membuat percakapan berarti ingin MELIHATNYA
  };

  const handleDeleteChat = (e, id) => {
    e.stopPropagation();
    // M4: dulu tanpa konfirmasi sama sekali — satu salah-sentuh di HP menghapus percakapan untuk
    // selamanya (riwayat hanya ada di peramban ini, tidak ada salinan di server). Hapus DOKUMEN
    // sudah bertanya sejak dulu; hapus percakapan justru tidak, padahal sama tak bisa dibatalkan.
    const judul = conversations.find(c => c.id === id)?.title || 'percakapan ini';
    if (!window.confirm(`Hapus "${judul}"? Riwayat percakapan ini hanya tersimpan di perangkat ini dan tidak bisa dikembalikan.`)) return;

    const filtered = conversations.filter(c => c.id !== id);
    if (filtered.length === 0) {
      // Satu sumber untuk percakapan awal — dulu sapaannya disalin ulang di sini dan sudah
      // menyimpang dari yang asli (kalimatnya terpotong).
      const awal = riwayatBaru();
      setConversations(awal);
      setCurrentConvId(awal[0].id);
    } else {
      setConversations(filtered);
      if (currentConvId === id) setCurrentConvId(filtered[0].id);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchDocuments(session.user.id);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchDocuments(session.user.id);
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchDocuments = async (userId) => {
    const { data, error } = await supabase.from('documents').select('id, title, created_at').eq('user_id', userId).order('created_at', { ascending: false });
    if (!error && data) {
      setDocuments(data);
    }
  };

  const handleDeleteDocument = async (id) => {
    const confirmDelete = window.confirm('Apakah Anda yakin ingin menghapus dokumen RAG ini? Otak AI akan melupakan isinya.');
    if (!confirmDelete) return;

    try {
      // Minta baris yang terhapus dikembalikan: DELETE yang tidak mengenai baris
      // apa pun tetap sukses tanpa error, jadi 0 baris = daftar di layar sudah basi.
      const { data, error } = await supabase.from('documents').delete().eq('id', id).select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        alert('Dokumen tidak ditemukan di server — kemungkinan sudah dihapus sebelumnya atau daftar ini sudah usang. Daftar dokumen dimuat ulang, periksa kembali dokumen yang ingin dihapus.');
      }
    } catch (err) {
      alert(`Gagal menghapus: ${err.message}`);
    } finally {
      // Berhasil atau gagal, selalu muat ulang dari server agar entri basi hilang.
      if (session) fetchDocuments(session.user.id);
    }
  };

  // Jam ikut ditampilkan agar dua unggahan berjudul sama di hari yang sama bisa dibedakan.
  const formatWaktu = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setGalatMasuk(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    // M4: dulu `alert(error.message)` — kotak sistem berisi bahasa Inggris ("Invalid login
    // credentials"). Kini di formulirnya sendiri, dalam bahasa Indonesia, di tempat mata pengguna
    // sudah berada.
    if (error) setGalatMasuk(pesanGalatMasuk(error));
    setAuthLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const fileInputRef = useRef(null);
  
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Periksa kunci SEBELUM apa pun dihapus: alur "timpa dokumen" di bawah menghapus
    // dokumen lama lebih dulu, jadi unggahan yang pasti gagal karena tanpa kunci akan
    // ikut menghilangkan dokumen lama.
    if (!(localStorage.getItem('x-byok-openrouter') || '').trim()) {
      alert('Unggah dokumen ke RAG memakai kunci OpenRouter Anda sendiri. Pasang kunci di Pengaturan (ikon gerigi di kiri atas), lalu coba lagi.');
      setPanelPengaturan(true);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    // Filter dokumen ganda / Update dokumen. Hanya DITANYAKAN di sini — dokumen lama baru
    // dihapus setelah unggahan baru berhasil (Item 69). Dulu dihapus lebih dulu, jadi unggahan
    // yang gagal (PDF scan, saldo habis…) ikut menghilangkan dokumen lama.
    const existingDoc = documents.find(doc => doc.title === file.name);
    if (existingDoc) {
      const confirmUpdate = window.confirm(`Dokumen bernama "${file.name}" sudah ada. Apakah Anda ingin menimpanya (memperbarui data)?`);
      if (!confirmUpdate) {
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    }

    setIsUploading(true);
    setStatusUnggah('Membaca dokumen…');

    // Memberikan waktu singkat agar browser (React) merender animasi putaran (spinner) sebelum memproses file berat
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      // PDF/DOCX diambil teksnya di browser (Item 69). Gagal (scan, terkunci, .doc lama…)
      // melempar GagalEkstrak berpesan jelas → alert di bawah, dokumen lama tetap utuh.
      let hasil = await ekstrakTeksDokumen(file, {
        onProgress: ({ halaman, total }) => {
          if (total) setStatusUnggah(`Membaca halaman ${halaman}/${total}…`);
        }
      });

      // Halaman PDF yang tampak bertabel (Item 76b): pdf.js meratakan kolomnya jadi satu baris
      // tanpa jeda. Tawarkan OCR mistral-ocr HANYA untuk halaman itu — opsional (Human-in-Command,
      // sama seperti gerbang konfirmasi Tier 3 Web Search). Kunci OpenRouter sudah dipastikan ada
      // di pemeriksaan awal fungsi ini.
      if (hasil.halamanBertabelTerdeteksi?.length) {
        const kunciOcr = (localStorage.getItem('x-byok-openrouter') || '').replace(/[^\x00-\x7F]/g, '').trim();
        const jumlah = hasil.halamanBertabelTerdeteksi.length;
        const lanjutOcr = window.confirm(
          `"${file.name}": ${jumlah} halaman tampak berupa tabel yang mungkin rusak dibaca pdf.js.\n\n` +
          `Perbaiki dengan OCR (mistral-ocr)? Perkiraan biaya ±$${perkiraanOcr(jumlah).toFixed(3)} ` +
          `dari saldo OpenRouter Anda, di luar biaya embedding.`
        );
        // OCR massal (2026-09-16): buku Kepbup 1.004 halaman menandai 939 halaman bertabel —
        // ±$1,9 dan berjam-jam. Konfirmasi kedua menyebut lama pengerjaan sebelum uang terpakai.
        const lanjutMassal = lanjutOcr && (jumlah <= OCR_BANYAK_HALAMAN || window.confirm(
          `${jumlah} halaman itu banyak.\n\n` +
          `Perkiraan: ±${perkiraanMenitOcr(jumlah)} menit dan ±$${perkiraanOcr(jumlah).toFixed(3)}, ` +
          `dikirim ${OCR_SERENTAK} halaman sekaligus agar tidak kena batas laju.\n` +
          `Halaman yang tetap gagal akan dilewati (teks biasa tetap dipakai), bukan membatalkan unggahan.\n\n` +
          `Lanjutkan OCR?`
        ));
        if (lanjutMassal) {
          setStatusUnggah(`Membaca ulang ${jumlah} halaman tabel dengan OCR…`);
          const { peta: petaOcr, halamanGagal } = await terapkanOcrHalaman(
            new Uint8Array(await file.arrayBuffer()),
            hasil.halamanBertabelTerdeteksi,
            kunciOcr,
            ({ ke, total, gagal }) => setStatusUnggah(`OCR halaman ${ke}/${total}${gagal ? ` (${gagal} dilewati)` : ''}…`)
          );
          if (halamanGagal.length) {
            console.warn(`[Mametlite] OCR melewati ${halamanGagal.length} halaman:`, halamanGagal.join(', '));
            alert(
              `${halamanGagal.length} dari ${jumlah} halaman gagal di-OCR dan dilewati — ` +
              `teks biasa untuk halaman itu tetap dipakai.\n\n` +
              `Halaman: ${halamanGagal.slice(0, 20).join(', ')}${halamanGagal.length > 20 ? ', …' : ''}`
            );
          }
          hasil = await ekstrakTeksDokumen(file, { petaOcrHalaman: petaOcr });
        }
      }

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

      // Embedding dibayar pengguna dengan kunci OpenRouter-nya sendiri (Item 63) — kunci
      // yang sama dengan yang dipakai chat.
      const openRouterKey = (localStorage.getItem('x-byok-openrouter') || '').replace(/[^\x00-\x7F]/g, '').trim();
      const { error } = await supabase.functions.invoke('rag-process', {
        body: { title: file.name, text: hasil.teks, userId: session.user.id },
        headers: openRouterKey ? { 'x-byok-openrouter': openRouterKey } : {}
      });

      if (error) {
        // Alasan sebenarnya ada di body jawaban, bukan di error.message yang umum.
        let pesan = error.message;
        try {
          const isi = await error.context?.json?.();
          if (isi?.error) pesan = isi.error;
        } catch {
          // Body bukan JSON — pakai pesan bawaan.
        }
        throw new Error(pesan);
      }

      // Versi baru sudah tersimpan — baru sekarang versi lama dihapus.
      if (existingDoc) {
        const { error: errHapus } = await supabase.from('documents').delete().eq('id', existingDoc.id);
        if (errHapus) console.warn(`[mametlite] Versi lama "${file.name}" gagal dihapus: ${errHapus.message}`);
      }

      setDocuments(prev => [{ id: Date.now(), title: file.name }, ...prev.filter(doc => doc.id !== existingDoc?.id)]); // Optimistic update, exact ID doesn't matter much until refresh
      fetchDocuments(session.user.id); // Refresh to get real ID

    } catch (err) {
      alert(`Gagal mengunggah: ${err.message}`);
    } finally {
      setIsUploading(false);
      setStatusUnggah('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const simpanKunci = () => {
    // Huruf non-ASCII dibuang: kunci yang disalin dari halaman OpenRouter kadang membawa spasi
    // tak terlihat, dan header HTTP menolaknya (jalur yang sama dipakai unggah & OCR).
    const bersih = isianKunci.replace(/[^\x00-\x7F]/g, '').trim();
    if (!bersih) { alert('Kunci masih kosong.'); return; }
    localStorage.setItem(KUNCI_OPENROUTER, bersih);
    setKunciTerpasang(true);
    setIsianKunci('');
    setPanelPengaturan(false);
  };

  const hapusKunci = () => {
    if (!confirm('Hapus kunci OpenRouter dari perangkat ini? Chat dan unggah dokumen akan berhenti bekerja sampai kunci dipasang lagi.')) return;
    localStorage.removeItem(KUNCI_OPENROUTER);
    setKunciTerpasang(false);
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    // Ditahan di sini supaya pengguna melihat tempat memperbaikinya, bukan galat NO_API_KEY dari server.
    if (!bacaKunci()) {
      setPanelPengaturan(true);
      alert('Mametlite memakai kunci OpenRouter Anda sendiri. Pasang kunci di Pengaturan (ikon gerigi di kiri atas), lalu kirim lagi.');
      return;
    }
    const userMsg = { role: 'user', content: input };
    updateMessages(prev => [...prev, userMsg]);
    const currentInput = input;
    setInput('');
    setLoading(true);

    try {
      // Build tools array HANYA berdasarkan tombol yang aktif
      let tools = [];
      
      // RAG Search - jika tombol RAG aktif
      if (activeModes.rag) {
        tools.push('rag_search');
      }
      
      // Web Search - HANYA jika tombol Web Search aktif
      if (activeModes.websearch) {
        tools.push('web_search');
      }
      
      // Deep Research - HANYA jika tombol Research aktif
      if (activeModes.research) {
        tools.push('deep_research');
      }

      // Fallback: jika semua tombol OFF, gunakan default RAG + Web Search
      if (tools.length === 0) {
        tools = ['rag_search', 'web_search'];
      }

      // Build chat history untuk context
      const chatHistory = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      // Kumpulkan BYOK keys dari localStorage
      const byokKeys = {
        'x-byok-gemini': localStorage.getItem('x-byok-gemini') || '',
        'x-byok-groq': localStorage.getItem('x-byok-groq') || '',
        'x-byok-openai': localStorage.getItem('x-byok-openai') || '',
        'x-byok-openrouter': localStorage.getItem('x-byok-openrouter') || ''
      };

      // Panggil agent backend dengan fungsi simple
      const response = await callAgentSimple(
        currentInput,
        tools,
        session.user.id,
        (session?.user?.email || 'user').split('@')[0],
        chatHistory,
        activeModes.rag,
        byokKeys
      );

      // Tambah placeholder untuk assistant message
      updateMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      // Parse SSE stream dan update message secara real-time
      const contentType = response.headers.get('Content-Type') || '';
      
      if (contentType.includes('text/event-stream')) {
        // Stream SSE
        await parseSSEStream(response, (chunk, fullContent) => {
          updateMessages(prev => {
            // Objek pesannya DIGANTI, bukan diubah di tempat. Bentuk lama menyalin array
            // (`[...prev]`) lalu menulis `newArr[len-1].content = …` — objeknya masih dibagi dengan
            // state sebelumnya, jadi mutasinya menembus ke belakang. Tidak aman di `StrictMode`.
            const arr = [...prev];
            arr[arr.length - 1] = { ...arr[arr.length - 1], content: fullContent };
            return arr;
          });
        });
      } else if (contentType.includes('application/json')) {
        // Fallback ke JSON response
        const data = await response.json();
        const textContent = data.content || data.text || data.message || JSON.stringify(data);
        updateMessages(prev => {
          const arr = [...prev];
          arr[arr.length - 1] = { ...arr[arr.length - 1], content: textContent };
          return arr;
        });
      } else {
        throw new Error('Unexpected response format');
      }
    } catch(err) {
      // M4 (2026-10-08): dulu `❌ Error: ${err.message}` — teks server APA ADANYA ke pegawai ASN di
      // HP (`ENGINEER_NO_API_KEY`, `Failed to fetch`, `Server error: 500`). Kini diterjemahkan beserta
      // TINDAKANNYA, dan teks teknisnya tetap ikut (kecil) karena pengguna HP tak punya DevTools.
      const pesan = pesanUntukPengguna(err);
      const isi = `⚠️ **${pesan.judul}**${pesan.saran ? ` ${pesan.saran}` : ''}\n\n*Pesan teknis: ${pesan.teknis}*`;
      updateMessages(prev => {
        const arr = [...prev];
        const akhir = arr[arr.length - 1];
        // Gelembung penampung yang masih KOSONG diganti, bukan ditinggalkan. Dulu arus yang gagal
        // meninggalkan gelembung asisten kosong DAN gelembung galat — dua gelembung untuk satu
        // kegagalan, yang membuatnya terbaca seperti jawaban yang hilang.
        if (akhir && akhir.role === 'assistant' && !akhir.content) {
          arr[arr.length - 1] = { ...akhir, content: isi };
          return arr;
        }
        return [...arr, { role: 'assistant', content: isi }];
      });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) return <div className="h-dvh bg-slate-900 flex items-center justify-center"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /></div>;

  if (!session) {
    return (
      <div className="flex h-dvh bg-slate-900 text-slate-200 items-center justify-center">
        <div className="w-full max-w-md bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-xl">
          <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-2xl mb-8">
            <Search className="w-8 h-8" /> Mamet Lite
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Email ASN / Admin</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-emerald-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-emerald-500 focus:outline-none" />
            </div>
            {galatMasuk && (
              <div role="alert" className="rounded-lg border border-red-700/60 bg-red-950/40 px-3 py-2">
                <p className="text-sm text-red-200 leading-snug">{galatMasuk.judul}</p>
                {galatMasuk.saran && <p className="mt-0.5 text-xs text-red-200/80 leading-snug">{galatMasuk.saran}</p>}
                <p className="mt-1.5 text-[11px] text-red-200/50 break-words leading-snug">Pesan teknis: {galatMasuk.teknis}</p>
              </div>
            )}
            <button type="submit" disabled={authLoading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 mt-4 transition-all disabled:opacity-60">
              {authLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />} Masuk ke Sistem
            </button>
          </form>
          <div className="mt-8 text-center text-xs text-slate-500">Created by <span className="font-semibold text-slate-400">mametdev@tm</span></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh bg-slate-900 text-slate-200">

      {/* TATA LETAK HP (M3, 2026-10-08) — Item 72, dan koreksi Owner 28 Sep yang menetapkan
          ukurannya: "kerapian suatu aplikasi di berbagai perangkat agar tidak membingungkan
          pengguna". Sampai 8 Okt 2026, NOL dari 102 `className` di berkas ini punya prefiks
          responsif. Bilah sisi `w-80` (320px, tanpa syarat) menyisakan ±55px untuk chat di HP
          375px, dan `min-w-0` di kolom chat membuatnya MENCIUT alih-alih menggulir — jadi chatnya
          benar-benar jadi sliver, bukan sekadar sempit.

          Yang dikerjakan: bilah sisi jadi laci di bawah ambang `md`, dan tetap menetap di atasnya.
          Satu berkas, tanpa dependency baru, tanpa DiscoveryManager, tanpa empat shell — persis
          seperti catatan Owner 2 Okt. */}

      {/* Lapisan gelap hanya ada saat laci terbuka DAN layarnya kecil; di `md` ke atas laci memang
          tidak pernah menutupi apa pun. */}
      {laciTerbuka && (
        <div
          onClick={() => setLaciTerbuka(false)}
          className="fixed inset-0 z-30 bg-slate-950/60 md:hidden"
          aria-hidden="true"
        />
      )}

      {/* Sidebar — laci di bawah `md`, menetap di atasnya */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-80 max-w-[85vw] transform transition-transform duration-200 md:static md:z-auto md:max-w-none md:translate-x-0 ${laciTerbuka ? 'translate-x-0' : '-translate-x-full'} bg-slate-800 border-r border-slate-700 p-4 flex flex-col`}
      >
        <div className="mb-6 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xl min-w-0">
            <Search className="w-6 h-6 shrink-0" /> <span className="truncate">Mamet Lite</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setPanelPengaturan((b) => !b)}
              title="Pengaturan kunci OpenRouter"
              aria-label="Pengaturan kunci OpenRouter"
              className={`p-2 rounded-lg transition-colors ${kunciTerpasang ? 'text-slate-400 hover:text-emerald-400 hover:bg-slate-700' : 'text-amber-400 bg-amber-400/10 hover:bg-amber-400/20'}`}
            >
              <Settings className="w-5 h-5" />
            </button>
            {/* Tutup laci — hanya di layar kecil. Di `md` ke atas bilah sisinya menetap dan tidak
                pernah menutupi apa pun, jadi tombol tutup di sana hanya membingungkan. */}
            <button
              onClick={() => setLaciTerbuka(false)}
              className="md:hidden p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-700"
              aria-label="Tutup daftar percakapan"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {!kunciTerpasang && !panelPengaturan && (
          <button
            onClick={() => setPanelPengaturan(true)}
            className="mb-3 text-left text-[11px] leading-snug text-amber-300 bg-amber-400/10 border border-amber-400/30 rounded-lg px-3 py-2 shrink-0"
          >
            Kunci OpenRouter belum dipasang — chat dan unggah dokumen belum bisa dipakai. Klik untuk memasang.
          </button>
        )}

        {panelPengaturan && (
          <div className="mb-4 bg-slate-900/70 border border-slate-700 rounded-xl p-3 shrink-0">
            <div className="flex items-center gap-2 text-slate-200 text-sm font-semibold mb-2">
              <KeyRound className="w-4 h-4 text-emerald-400" /> Kunci OpenRouter
            </div>
            <p className="text-[11px] text-slate-400 leading-snug mb-2">
              Kunci disimpan di perangkat ini saja (localStorage), dikirim langsung untuk permintaan Anda sendiri.
              Dipakai untuk chat, embedding dokumen, dan OCR PDF.
            </p>
            <input
              type="password"
              value={isianKunci}
              onChange={(e) => setIsianKunci(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') simpanKunci(); }}
              placeholder={kunciTerpasang ? 'Kunci sudah terpasang — isi untuk mengganti' : 'Tempel kunci OpenRouter di sini'}
              autoComplete="off"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
            />
            <div className="flex items-center gap-2 mt-2">
              <button onClick={simpanKunci} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                Simpan
              </button>
              {kunciTerpasang && (
                <button onClick={hapusKunci} className="text-xs text-slate-400 hover:text-red-400 px-2 py-1.5 transition-colors">
                  Hapus kunci
                </button>
              )}
              <span className={`ml-auto text-[10px] ${kunciTerpasang ? 'text-emerald-400' : 'text-amber-400'}`}>
                {kunciTerpasang ? 'terpasang' : 'belum ada'}
              </span>
            </div>
          </div>
        )}

        <input type="file" ref={fileInputRef} onChange={handleUpload} className="hidden" accept={ACCEPT_UNGGAH} />
        <button 
          onClick={handleUploadClick} 
          disabled={isUploading}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shrink-0"
        >
          {isUploading ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> {statusUnggah || 'Memproses AI...'}</>
          ) : (
            <><Upload className="w-5 h-5" /> Unggah Dokumen (RAG)</>
          )}
        </button>

        {/* RAG Documents List */}
        {documents.length > 0 && (
          <div className="mt-4 shrink-0">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Dokumen Aktif</h3>
            <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
              {documents.map((doc) => (
                <div key={doc.id} className="group text-[11px] text-slate-300 bg-slate-700/50 px-2 py-1.5 rounded flex items-center justify-between border border-slate-600/50 hover:bg-slate-700 transition-colors">
                  <div className="flex items-center gap-2 truncate">
                    <BookOpen className="w-3 h-3 text-indigo-400 shrink-0" />
                    <span className="truncate" title={formatWaktu(doc.created_at)}>{doc.title}</span>
                  </div>
                  <button onClick={() => handleDeleteDocument(doc.id)} className="opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:text-red-400 p-1 transition-opacity shrink-0">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex-1 flex flex-col min-h-0">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 shrink-0">Riwayat Percakapan</h3>
          <div className="flex-1 overflow-y-auto space-y-1 -mx-2 px-2">
            {conversations.map(conv => (
              <div 
                key={conv.id} 
                onClick={() => { setCurrentConvId(conv.id); setLaciTerbuka(false); }}
                className={`group flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all ${currentConvId === conv.id ? 'bg-slate-700 text-emerald-400' : 'hover:bg-slate-700/50 text-slate-300'}`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <MessageSquare className="w-4 h-4 shrink-0" />
                  <span className="text-sm truncate">{conv.title}</span>
                </div>
                <button onClick={(e) => handleDeleteChat(e, conv.id)} className="opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:text-red-400 transition-opacity p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Token stats dihapus - menggunakan callAgentSimple tanpa optimization */}

        <div className="mt-4 pt-4 border-t border-slate-700 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-400 flex items-center gap-2 truncate">
            <User className="w-4 h-4" />
            <span className="truncate">{session.user.email}</span>
          </div>
          <button onClick={handleLogout} className="p-2 hover:bg-slate-700 text-slate-400 hover:text-red-400 rounded-lg transition-all" title="Keluar">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-2 text-center text-[10px] text-slate-500 shrink-0">Created by <span className="font-semibold text-slate-400">mametdev@tm</span></div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative min-w-0">
        {/* Header */}
        <div className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center px-3 md:px-6 justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 md:gap-4 min-w-0">
            {/* Satu-satunya jalan masuk ke daftar percakapan di HP. Tanpa ini lacinya tidak bisa
                dibuka sama sekali — jadi ia bukan hiasan. */}
            <button
              onClick={() => setLaciTerbuka(true)}
              className="md:hidden p-2 -ml-1 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 shrink-0"
              aria-label="Buka daftar percakapan"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="font-semibold text-slate-300 truncate">Pusat Riset ASN</h2>
            <button onClick={handleNewChat} className="flex items-center gap-1 text-xs px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-emerald-400 border border-slate-700 rounded-md transition-all shrink-0" aria-label="Percakapan Baru">
              <Plus className="w-3 h-3 shrink-0" /> <span className="hidden sm:inline">Percakapan Baru</span>
            </button>
          </div>

          {/* Tiga tombol berlabel penuh ≈380px. Di kolom chat HP itu mustahil, dan dulu tidak ada
              `flex-wrap` maupun `overflow-x-auto` yang menyelamatkannya. Labelnya karena itu muncul
              hanya saat ada ruang; ikon + `aria-label` + `title` tetap menjelaskan fungsinya. */}
          <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700 shrink-0">
            <button onClick={() => toggleMode('rag')} title="Database RAG" aria-label="Database RAG" aria-pressed={activeModes.rag} className={`px-2 lg:px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeModes.rag ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
              <BookOpen className="w-4 h-4 shrink-0" /> <span className="hidden lg:inline">Database RAG</span>
            </button>
            <button onClick={() => toggleMode('websearch')} title="Web Search" aria-label="Web Search" aria-pressed={activeModes.websearch} className={`px-2 lg:px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeModes.websearch ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
              <Globe className="w-4 h-4 shrink-0" /> <span className="hidden lg:inline">Web Search</span>
            </button>
            <button onClick={() => toggleMode('research')} title="Deep Research" aria-label="Deep Research" aria-pressed={activeModes.research} className={`px-2 lg:px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeModes.research ? 'bg-purple-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
              <Search className="w-4 h-4 shrink-0" /> <span className="hidden lg:inline">Deep Research</span>
            </button>
          </div>
        </div>

        {/* Chat Messages */}
        {/* Riwayat gagal dibaca/disimpan → dikatakan, bukan didiamkan. Di jalur chat (bukan di bilah
            sisi yang di HP belum terjangkau), dan bisa ditutup supaya tidak jadi peringatan permanen
            — peringatan yang selalu menyala sama tak bergunanya dengan yang tak pernah menyala. */}
        {masalahRiwayat && (
          <div className="mx-6 mt-4 rounded-lg border border-amber-700/60 bg-amber-950/40 px-3 py-2 flex items-start gap-3">
            <p className="text-xs text-amber-200/90 leading-snug flex-1">{masalahRiwayat}</p>
            <button
              onClick={() => setMasalahRiwayat(null)}
              className="text-xs text-amber-200/70 hover:text-amber-100 shrink-0 px-1"
              aria-label="Tutup pemberitahuan"
            >
              Tutup
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-4 max-w-4xl mx-auto ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-indigo-500' : 'bg-emerald-600'}`}>
                {msg.role === 'user' ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-white" />}
              </div>
              <div className={`p-4 rounded-2xl max-w-[80%] overflow-x-auto relative group ${msg.role === 'user' ? 'bg-indigo-600/20 text-indigo-100 rounded-tr-none border border-indigo-500/30' : 'bg-slate-800 rounded-tl-none border border-slate-700'}`}>
                {msg.role === 'assistant' && (
                  <div className="absolute top-2 right-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity bg-slate-800 rounded border border-slate-600 shadow-sm z-10">
                    <CopyButton text={msg.content} />
                  </div>
                )}
                {msg.role === 'assistant'
                  ? <JawabanBerlabel teks={msg.content} />
                  : <TeksKaya teks={msg.content} className="text-sm leading-relaxed" />}
              </div>
            </div>
          ))}
          {loading && (
             <div className="flex gap-4 max-w-4xl mx-auto">
               <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center shrink-0">
                 <Loader2 className="w-5 h-5 text-white animate-spin" />
               </div>
               <div className="p-4 rounded-2xl bg-slate-800 rounded-tl-none border border-slate-700 flex items-center">
                 <span className="text-slate-400 text-sm animate-pulse">Sedang mencari data...</span>
               </div>
             </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 shrink-0">
          <div className="max-w-4xl mx-auto relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={activeModes.rag && !activeModes.websearch && !activeModes.research ? "Cari informasi di dokumen yang diunggah..." : "Cari dokumen atau riset web..."}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl py-4 pl-4 pr-14 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-slate-200 placeholder-slate-500 shadow-inner"
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="absolute right-2 top-2 bottom-2 aspect-square bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg flex items-center justify-center transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
