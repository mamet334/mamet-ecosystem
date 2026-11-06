import { createClient } from '@supabase/supabase-js';
import { jenisTautanAuth } from '../../shared/kata_sandi.js';

export const jenisTautanAwal = typeof window !== 'undefined' ? jenisTautanAuth(window.location.hash, window.location.search) : null;

const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || '';
const supabaseAnonKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
