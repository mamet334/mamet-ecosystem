// Workspace (knowledge_spaces) dari UI Research App — buat, ganti nama, hapus bila kosong (2026-09-21).
//
// Sebelum ini tidak ada tombol untuk membuat workspace; satu-satunya pembuat adalah sub-agent knowledge_manager, yang
// menamai workspace dengan kalimat chat ("Observasi Pasar Freelance dan tampilkan hasilnya saja", "Berapa pejabat
// struktural …?") — lalu Research App memilih space terbaru sebagai bawaan, jadi unggahan RAG mendarat di sana (T9).
//
// Catatan pencarian: chat mencari di SEMUA workspace milik pengguna (document_search.ts, Item 65). Workspace hanya
// membatasi pencarian bila namanya disebut lengkap bersama kata "workspace"/"ruang"/"space" (routing_decider.ts).

export const PANJANG_NAMA_MAKS = 60;
const KUNCI_TERPILIH = 'research_space_terpilih';

// Nama dirapikan (spasi ganda, tepi) lalu diperiksa. kecualiId: workspace yang sedang diganti namanya.
export function periksaNamaRuang(mentah, daftar = [], kecualiId = null) {
    const nama = String(mentah ?? '').replace(/\s+/g, ' ').trim();
    if (!nama) return { ok: false, nama, pesan: 'Nama workspace belum diisi.' };
    if (nama.length > PANJANG_NAMA_MAKS) return { ok: false, nama, pesan: `Nama terlalu panjang (${nama.length} huruf, maksimal ${PANJANG_NAMA_MAKS}).` };
    if (nama.toLowerCase() === 'global') return { ok: false, nama, pesan: '"global" dipakai sistem — pilih nama lain.' };
    const kembar = daftar.find((s) => s.id !== kecualiId && String(s.name).toLowerCase() === nama.toLowerCase());
    if (kembar) return { ok: false, nama, pesan: `Nama "${kembar.name}" sudah dipakai workspace lain.` };
    return { ok: true, nama, pesan: '' };
}

// Workspace bawaan saat Research App dibuka: pilihan terakhir pengguna bila masih ada; bila tidak, yang pertama di
// daftar (terbaru) — sama seperti sebelumnya.
export function pilihRuangAwal(daftar = [], idTersimpan = null) {
    if (idTersimpan && daftar.some((s) => s.id === idTersimpan)) return idTersimpan;
    return daftar[0]?.id ?? null;
}

// CORE dipakai rag-process bila tak ada workspace dipilih — tidak boleh dihapus dari UI.
export const bolehDihapus = (ruang) => !!ruang && ruang.space_type !== 'CORE';

export function ingatRuangTerpilih(id) {
    try { if (id) localStorage.setItem(KUNCI_TERPILIH, id); } catch { /* penyimpanan browser tak tersedia */ }
}
export function ruangTerpilihTersimpan() {
    try { return localStorage.getItem(KUNCI_TERPILIH); } catch { return null; }
}

const pesanDb = (error) => (error?.code === '23505' ? 'Nama itu sudah dipakai workspace lain.' : (error?.message || String(error)));

export async function buatRuang(supabase, userId, nama) {
    const { data, error } = await supabase.from('knowledge_spaces')
        .insert({ user_id: userId, name: nama, space_type: 'WORKSPACE' })
        .select('*').single();
    if (error) throw new Error(pesanDb(error));
    return data;
}

export async function gantiNamaRuang(supabase, id, nama) {
    const { data, error } = await supabase.from('knowledge_spaces')
        .update({ name: nama, updated_at: new Date().toISOString() })
        .eq('id', id).select('id');
    if (error) throw new Error(pesanDb(error));
    if (!data?.length) throw new Error('Workspace tidak ditemukan di server — daftar dimuat ulang.');
}

// Dokumen ikut terhapus bila workspace dihapus (FK ON DELETE CASCADE) — maka jumlah dokumen diperiksa di server
// tepat sebelum menghapus, bukan dari daftar di layar yang bisa basi.
export async function hapusRuangKosong(supabase, ruang) {
    if (!bolehDihapus(ruang)) throw new Error('Workspace inti (CORE) tidak bisa dihapus.');
    const { count, error: errHitung } = await supabase.from('documents')
        .select('id', { count: 'exact', head: true }).eq('space_id', ruang.id);
    if (errHitung) throw new Error(pesanDb(errHitung));
    if (count > 0) throw new Error(`Workspace "${ruang.name}" masih berisi ${count} dokumen. Hapus dokumennya dulu.`);
    const { data, error } = await supabase.from('knowledge_spaces')
        .delete().eq('id', ruang.id).neq('space_type', 'CORE').select('id');
    if (error) throw new Error(pesanDb(error));
    if (!data?.length) throw new Error('Workspace tidak ditemukan di server — daftar dimuat ulang.');
}
