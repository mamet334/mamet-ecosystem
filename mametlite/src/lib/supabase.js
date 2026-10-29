import { createClient } from '@supabase/supabase-js';
import { jenisTautanAuth } from '../../../shared/kata_sandi.js';

// T19 (29 Okt 2026): jenis tautan yang membuka halaman ini — dibaca SEBELUM createClient, yang membersihkan
// `#access_token=…&type=recovery` dari alamat. App.jsx menahan pengguna di layar "kata sandi baru" bila 'pemulihan'.
export const jenisTautanAwal = typeof window !== 'undefined' ? jenisTautanAuth(window.location.hash, window.location.search) : null;

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
