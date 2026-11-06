
export const PANJANG_NAMA_MAKS = 60;
const KUNCI_TERPILIH = 'research_space_terpilih';

export function periksaNamaRuang(mentah, daftar = [], kecualiId = null) {
    const nama = String(mentah ?? '').replace(/\s+/g, ' ').trim();
    if (!nama) return { ok: false, nama, pesan: 'Nama workspace belum diisi.' };
    if (nama.length > PANJANG_NAMA_MAKS) return { ok: false, nama, pesan: `Nama terlalu panjang (${nama.length} huruf, maksimal ${PANJANG_NAMA_MAKS}).` };
    if (nama.toLowerCase() === 'global') return { ok: false, nama, pesan: '"global" dipakai sistem — pilih nama lain.' };
    const kembar = daftar.find((s) => s.id !== kecualiId && String(s.name).toLowerCase() === nama.toLowerCase());
    if (kembar) return { ok: false, nama, pesan: `Nama "${kembar.name}" sudah dipakai workspace lain.` };
    return { ok: true, nama, pesan: '' };
}

export function pilihRuangAwal(daftar = [], idTersimpan = null) {
    if (idTersimpan && daftar.some((s) => s.id === idTersimpan)) return idTersimpan;
    return daftar[0]?.id ?? null;
}

export const bolehDihapus = (ruang) => !!ruang && ruang.space_type !== 'CORE';

export function ingatRuangTerpilih(id) {
    try { if (id) localStorage.setItem(KUNCI_TERPILIH, id); } catch {  }
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
