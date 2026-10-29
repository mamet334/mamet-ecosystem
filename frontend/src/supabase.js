import { createClient } from '@supabase/supabase-js';
import { jenisTautanAuth } from '../../shared/kata_sandi.js';

// T19 (29 Okt 2026): jenis tautan otentikasi yang membuka halaman ini — dibaca SEBELUM createClient, karena klien
// membersihkan `#access_token=…&type=recovery` dari alamat sesudah memprosesnya. App.jsx memakainya untuk menampilkan
// layar "buat kata sandi baru" sebelum masuk desktop (tautan pemulihan memang langsung membuat sesi).
export const jenisTautanAwal = typeof window !== 'undefined' ? jenisTautanAuth(window.location.hash, window.location.search) : null;

const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || '';
const supabaseAnonKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
