/**
 * grafHome.js — penyusun simpul & garis graf Home (Item 130; Tahap A memindahkannya dari `useDashboardData.js` supaya
 * bisa diuji tanpa peramban & Supabase; Tahap C menyusunnya ulang menurut Konstitusi 23 revisi 2 Nov 2026).
 * Murni: menerima baris yang sudah diambil, memulangkan `{ nodes, links, stats }`.
 */

/**
 * Isi Knowledge Directory = simpul DATA saja (memori, dokumen, percakapan). Dulu "bukan kategori" — sehingga 12 sub-cluster
 * statis (tanpa `isCategory`) dan 11 layanan ikut terdaftar sebagai entitas berlencana bawaan MEMORI (481 = 458 + 23).
 */
export const GRUP_DATA = Object.freeze(['memory', 'rag', 'chat']);
export function simpulDirektori(nodes) {
  return (nodes || []).filter((n) => GRUP_DATA.includes(n.group));
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// TATA SURYA (Item 130 Tahap F, Konstitusi 23 revisi 3 Nov 2026) — menggantikan tata letak gaya fisika Tahap A–E.
//
// Dulu simpul saling tolak & tarik lalu "mencari keseimbangan" (d3-force): graf memantul ±15 detik, posisi planet acak,
// data menggumpal jadi awan, dan setiap pasang label yang dibereskan dengan menyetel gaya memunculkan pasang lain
// (lihat changelog Tahap A–E). Owner 3 Nov: "seharusnya seperti tata surya — matahari, planet beserta bulannya."
// Kini posisi DIHITUNG (rumus orbit) dan DIPAKU (fx/fy):
//   bintang ganda   MAMET · Desktop (−jarak, 0) & Server (+jarak, 0)
//   planet          5 kemampuan di satu orbit, sudut dibagi rata (URUTAN_PLANET), jari-jari orbit dari ukuran sistemnya
//   bulan           data milik planet dalam cincin-cincin konsentris (terbesar paling dalam); pesan = bulan percakapan
//   planet luar     fondasi di orbit luar, di sela planet
//   satelit         lapisan Kemampuan (hub & alatnya) di luar sistem induknya
// Tanpa garis orbit (keputusan Owner). Diam — tak berputar.
// ═════════════════════════════════════════════════════════════════════════════════════════════════

export const ORBIT = Object.freeze({
  jarakBintang: 30,      // setengah jarak Desktop–Server
  ruangBintang: 72,      // jari-jari ruang kosong di sekitar bintang: planet tak boleh masuk (cukup bagi satelit sub-agent)
  jedaBulan: 1.5,        // sela antar-bulan dalam satu cincin
  jedaCincin: 2,         // sela antar-cincin bulan
  jedaSistem: 16,        // sela antar-sistem planet bertetangga
  jedaFondasi: 40,       // sela orbit luar dari sistem planet terbesar
  jedaSatelit: 14,       // sela satelit (hub lapisan) dari sistem induknya
  // Derajat: satelit tak lurus keluar dari induknya (jalur label induk), tetapi menyamping. Diukur 3 Nov (layar Owner,
  // 1920, 768; lapisan & lapisan + ekor): 0° & 50° → 1 label tersembunyi, −50° → 2, 70° → 0 di semua keadaan.
  putarSatelit: 70,
});
export const URUTAN_PLANET = Object.freeze(['kem-chat', 'kem-memori', 'kem-rag', 'kem-tabel', 'kem-engineer']);
// Sudut fondasi (derajat, 0 = kanan, searah jarum jam di layar): di SELA planet (planet di −90 + 72·i).
const SUDUT_FONDASI = Object.freeze({ 'fon-supabase': -54, 'fon-openrouter': 90, 'fon-electron': -126 });
// Satelit lapisan Kemampuan → induknya (sistem yang ia kitari).
const INDUK_SATELIT = Object.freeze({ 'lap-alat-chat': 'kem-chat', 'lap-alat-folder': 'kem-engineer', 'lap-mcp': 'fon-electron', 'lap-subagen': 'mamet-server' });

/** Jari-jari simpul di kanvas — force-graph: √val × nodeRelSize (ActivityGraph nodeRelSize = 1). */
export const jariSimpul = (n) => Math.sqrt(Math.max(0, n?.val || 1));

/**
 * Bulan dalam cincin konsentris di sekeliling (0,0). Bulan diurut menurun; tiap cincin diisi sebanyak muat menurut bulan
 * TERBESAR di cincin itu (busur ≥ 1,1 × (diameter + sela), cukup juga bagi tali busur); cincin berikutnya di luar.
 * @returns {{ posisi: Map<object, [number, number]>, jari: number }} posisi relatif & jari-jari luar sistem
 */
export function cincinBulan(bulan, jariInti) {
  const urut = [...(bulan || [])].sort((a, b) => jariSimpul(b) - jariSimpul(a));
  const posisi = new Map();
  let tepi = jariInti + ORBIT.jedaCincin, i = 0, ke = 0;
  while (i < urut.length) {
    const jb = jariSimpul(urut[i]);
    const r = tepi + jb;
    const kap = Math.max(1, Math.floor((2 * Math.PI * r) / (1.1 * (2 * jb + ORBIT.jedaBulan))));
    const isi = urut.slice(i, i + kap);
    isi.forEach((n, k) => { const a = (2 * Math.PI * k) / isi.length + ke * 0.5; posisi.set(n, [r * Math.cos(a), r * Math.sin(a)]); });
    i += kap; ke++; tepi = r + jb + ORBIT.jedaCincin;
  }
  return { posisi, jari: urut.length ? tepi : jariInti };
}

const idOf = (x) => x?.id ?? x;

/**
 * Induk langsung tiap bulan/satelit — dari garis STRUKTUR saja (bukan garis relasi seperti memori → asalnya).
 * @returns {Map<string, object[]>} id induk → simpul anaknya
 */
export function anakStruktur({ nodes, links }) {
  const byId = new Map((nodes || []).map((n) => [n.id, n]));
  const anak = new Map();
  const tambah = (induk, n) => { if (!anak.has(induk)) anak.set(induk, []); if (!anak.get(induk).includes(n)) anak.get(induk).push(n); };
  (links || []).forEach((l) => {
    const s = byId.get(idOf(l.source)), t = idOf(l.target);
    if (!s || !byId.has(t)) return;
    if (GRUP_DATA.includes(s.group) && t.startsWith('kem-')) tambah(t, s);
    else if (s.group === 'pesan' && t.startsWith('chat-')) tambah(t, s);
    else if (s.group === 'alat' && t.startsWith('lap-')) tambah(t, s);
    else if (s.group === 'lapisan' && s.id.startsWith('lap-konektor-') && t === 'lap-mcp') tambah(t, s);
  });
  return anak;
}

/**
 * Seluruh isi sistem sebuah simpul (bulan, satelit, bulan dari bulan — berulang), yang ikut bergerak saat simpul itu
 * digeser (keputusan Owner 3 Nov: "bulan mengikuti planetnya"). Satelit lapisan Kemampuan ikut induknya (INDUK_SATELIT).
 * @returns {Map<string, object[]>} id simpul → semua keturunannya (tanpa dirinya)
 */
export function keturunanSistem({ nodes, links }) {
  const byId = new Map((nodes || []).map((n) => [n.id, n]));
  const anak = anakStruktur({ nodes, links });
  Object.entries(INDUK_SATELIT).forEach(([hubId, indukId]) => {
    if (!byId.has(hubId) || !byId.has(indukId)) return;
    if (!anak.has(indukId)) anak.set(indukId, []);
    anak.get(indukId).push(byId.get(hubId));
  });
  const hasil = new Map();
  const kumpul = (id, lihat) => (anak.get(id) || []).flatMap((n) => (lihat.has(n.id) ? [] : (lihat.add(n.id), [n, ...kumpul(n.id, lihat)])));
  anak.forEach((_, id) => hasil.set(id, kumpul(id, new Set([id]))));
  return hasil;
}

/**
 * Seretan simpul: `mulaiSeret` mencatat seluruh sistemnya beserta posisi awal; `ikutSeret` menggeser semuanya sejauh
 * simpul itu bergeser dari titik awal seretan (dipanggil tiap gerakan, mutlak terhadap awal — tak menumpuk galat).
 */
export function mulaiSeret(graf, node) {
  const awal = node.__initialDragPos || { x: node.x, y: node.y };
  const ikut = (keturunanSistem(graf).get(node.id) || []).map((n) => ({ n, x: n.x, y: n.y }));
  return { id: node.id, x: awal.x, y: awal.y, ikut };
}
export function ikutSeret(seret, node) {
  const dx = node.x - seret.x, dy = node.y - seret.y;
  seret.ikut.forEach(({ n, x, y }) => { n.fx = n.x = x + dx; n.fy = n.y = y + dy; });
  return [dx, dy];
}

/**
 * Menerapkan geseran Owner (id → [dx, dy] kumulatif) sesudah `tataSurya`: simpul & seluruh sistemnya ikut pindah, jadi
 * planet yang digeser tetap di tempat barunya saat graf disusun ulang (data baru, ekor pesan dibuka, lapisan dinyalakan).
 */
export function terapkanGeser(graf, geser) {
  if (!geser?.size) return;
  const byId = new Map((graf.nodes || []).map((n) => [n.id, n]));
  const turun = keturunanSistem(graf);
  geser.forEach(([dx, dy], id) => {
    const n = byId.get(id);
    if (!n || n.fx === undefined) return;
    [n, ...(turun.get(id) || [])].forEach((m) => { m.fx = m.x = m.fx + dx; m.fy = m.y = m.fy + dy; });
  });
}

/**
 * Memaku setiap simpul yang dikenal ke posisinya (fx/fy, x/y) dan memberi arah labelnya. Mengubah simpul di tempat;
 * simpul yang tak dikenal dibiarkan. Hanya membaca garis struktur (bulan → induk), bukan garis relasi.
 * @returns {{ jariOrbit: number, jariLuar: number, sistem: Map<string, number> }} ukuran yang dipakai (untuk uji)
 */
export function tataSurya({ nodes, links }) {
  const byId = new Map((nodes || []).map((n) => [n.id, n]));
  const pakai = (n, x, y) => { n.fx = n.x = x; n.fy = n.y = y; };
  const keluar = (n, x, y, jarak) => {   // label di sisi luar (menjauhi pusat), sejauh `jarak` dari simpul
    const d = Math.hypot(x, y) || 1, ux = x / d, uy = y / d;
    n.labelGeser = [ux * jarak, uy * jarak];
    n.labelArah = ux > 0.35 ? 'kanan' : ux < -0.35 ? 'kiri' : undefined;
    n.labelAtas = uy < -0.35;
  };

  const anak = anakStruktur({ nodes, links });

  // Bintang ganda.
  const D = ORBIT.jarakBintang;
  if (byId.has('mamet-desktop')) pakai(byId.get('mamet-desktop'), -D, 0);
  if (byId.has('mamet-server')) pakai(byId.get('mamet-server'), D, 0);

  // Sistem planet & jari-jari orbit: cukup jauh dari bintang, dan sistem bertetangga tak bersentuhan.
  const planet = URUTAN_PLANET.filter((id) => byId.has(id)).map((id) => byId.get(id));
  const sistem = new Map(planet.map((p) => [p.id, cincinBulan(anak.get(p.id), jariSimpul(p))]));
  const S = (p) => sistem.get(p.id).jari;
  const N = planet.length;
  let jariOrbit = Math.max(0, ...planet.map((p) => ORBIT.ruangBintang + S(p)));
  if (N > 1) planet.forEach((p, i) => {
    const q = planet[(i + 1) % N];
    jariOrbit = Math.max(jariOrbit, (S(p) + S(q) + ORBIT.jedaSistem) / (2 * Math.sin(Math.PI / N)));
  });
  planet.forEach((p, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / N;
    const x = jariOrbit * Math.cos(a), y = jariOrbit * Math.sin(a);
    pakai(p, x, y);
    keluar(p, x, y, S(p) + 3);
    sistem.get(p.id).posisi.forEach(([bx, by], b) => pakai(b, x + bx, y + by));
  });

  // Planet luar: fondasi.
  const jariLuar = jariOrbit + Math.max(0, ...planet.map(S)) + ORBIT.jedaFondasi;
  Object.entries(SUDUT_FONDASI).forEach(([id, deg]) => {
    if (!byId.has(id)) return;
    const a = (deg * Math.PI) / 180, x = jariLuar * Math.cos(a), y = jariLuar * Math.sin(a);
    pakai(byId.get(id), x, y);
    keluar(byId.get(id), x, y, jariSimpul(byId.get(id)) + 3);
  });

  // Satelit lapisan Kemampuan — di luar sistem induknya (menjauhi pusat); sub-agent di ruang kosong sekitar Server.
  const jariSistem = (id) => (sistem.has(id) ? sistem.get(id).jari : jariSimpul(byId.get(id)));
  const pasangSatelit = (hub, ix, iy, ux, uy, jarakInduk) => {
    const sys = cincinBulan(anak.get(hub.id), jariSimpul(hub));
    const jarak = jarakInduk + ORBIT.jedaSatelit + sys.jari;
    const x = ix + ux * jarak, y = iy + uy * jarak;
    pakai(hub, x, y);
    keluar(hub, ux, uy, sys.jari + 3);
    sys.posisi.forEach(([bx, by], b) => pakai(b, x + bx, y + by));
    return { x, y, jari: sys.jari };
  };
  Object.entries(INDUK_SATELIT).forEach(([hubId, indukId]) => {
    const hub = byId.get(hubId), induk = byId.get(indukId);
    if (!hub || !induk || induk.fx === undefined) return;
    if (hubId === 'lap-subagen') { pasangSatelit(hub, induk.fx, induk.fy, 0, 1, jariSimpul(induk)); return; }
    // Arah satelit = keluar dari pusat, DIPUTAR menyamping (ORBIT.putarSatelit): lurus keluar ia duduk tepat di jalur
    // label induknya (yang juga menghadap keluar) — diukur: label "Alat folder" tertabrak label "Engineer".
    const d = Math.hypot(induk.fx, induk.fy) || 1;
    const p = ORBIT.putarSatelit * Math.PI / 180;
    const ux = (induk.fx * Math.cos(p) - induk.fy * Math.sin(p)) / d, uy = (induk.fx * Math.sin(p) + induk.fy * Math.cos(p)) / d;
    const h = pasangSatelit(hub, induk.fx, induk.fy, ux, uy, jariSistem(indukId));
    if (hubId === 'lap-mcp') {
      // Konektor = satelit dari satelit MCP, menyebar ±25° bila lebih dari satu.
      (anak.get('lap-mcp') || []).forEach((k, i, semua) => {
        const sudut = (i - (semua.length - 1) / 2) * (25 * Math.PI / 180);
        const vx = ux * Math.cos(sudut) - uy * Math.sin(sudut), vy = ux * Math.sin(sudut) + uy * Math.cos(sudut);
        pasangSatelit(k, h.x, h.y, vx, vy, h.jari);
      });
    }
  });

  // Bulan dari bulan: pesan di sekeliling percakapan yang dibuka (Tahap E).
  anak.forEach((isi, indukId) => {
    const induk = byId.get(indukId);
    if (!indukId.startsWith('chat-') || !induk || induk.fx === undefined) return;
    cincinBulan(isi, jariSimpul(induk)).posisi.forEach(([bx, by], b) => pakai(b, induk.fx + bx, induk.fy + by));
  });

  return { jariOrbit, jariLuar, sistem: new Map([...sistem].map(([id, s]) => [id, s.jari])) };
}

/**
 * Garis relasi = jaring laba-laba, SELALU tampil (keputusan Owner 3 Nov: "jalur hubungan itu fiturnya"; sempat
 * disembunyikan di awal Tahap F). Saat simpul dipilih, garisnya — dan pesan → alat untuk percakapan yang dipilih —
 * MENYALA, sisanya meredup.
 */
export function garisMenyala(link, terpilih) {
  if (!terpilih) return false;
  const s = idOf(link?.source), t = idOf(link?.target);
  return s === terpilih || t === terpilih || (typeof s === 'string' && s.startsWith(`pesan-${terpilih}-`));
}

/**
 * Tinggi pita judul + legenda di atas kanvas (ActivityGraph: top-8 + judul 38px + subjudul + legenda satu baris ≈ 132px,
 * ditambah sela). `zoomToFit` force-graph hanya mengenal satu padding di keempat sisi, jadi graf yang kini lebih besar
 * (Tahap C) masuk ke bawah legenda — awan Chat menimpa "Kemampuan · MAMET / Fondasi" (tangkapan layar Owner 2 Nov).
 */
export const RUANG_ATAS = 150;

/**
 * Pengganti `zoomToFit` yang menyisakan pita atas: graf dimuat ke wilayah [padding, lebar−padding] × [atas, tinggi−padding].
 * Rumus layar force-graph: layar = (graf − pusatKamera) × k + ukuran/2.
 * @returns {{ x: number, y: number, k: number }} titik graf untuk `centerAt` dan skala untuk `zoom`
 */
export function tataPas({ bbox, lebar, tinggi, padding = 50, atas = RUANG_ATAS }) {
  const bw = Math.max(1e-6, bbox.x[1] - bbox.x[0]), bh = Math.max(1e-6, bbox.y[1] - bbox.y[0]);
  const k = Math.max(1e-12, Math.min((lebar - padding * 2) / bw, (tinggi - atas - padding) / bh));
  const tengahLayarY = (atas + tinggi - padding) / 2;
  return {
    x: (bbox.x[0] + bbox.x[1]) / 2,
    y: (bbox.y[0] + bbox.y[1]) / 2 - (tengahLayarY - tinggi / 2) / k,
    k,
  };
}

/**
 * Nama simpul data (judul chat, dokumen, memori) baru tampil di kanvas pada skala ini. Dulu 0,75 — begitu tata letak
 * dirapatkan, layar 1920×1080 langsung melewatinya saat dibuka (skala pas 0,78) dan 490 nama tampil bertumpuk.
 * Nama tetap bisa dibaca lewat sorot (tooltip) dan Knowledge Directory.
 */
export const AMBANG_LABEL_DATA = 2;

/**
 * Ambang nama simpul data RELATIF terhadap skala pas kamera (Tahap F). Tata surya membuat graf jauh lebih besar: layar
 * 2560 dibuka pada skala 2,36 — melewati ambang tetap 2 → 468 nama tampil sekaligus. Kini nama data tampil sesudah Owner
 * memperbesar ±1,8× dari pandangan awal, apa pun layarnya (dan tak pernah di bawah 2).
 */
export const FAKTOR_LABEL_DATA = 1.8;
export function ambangLabelData(skalaPas) {
  return Math.max(AMBANG_LABEL_DATA, (Number(skalaPas) || 0) * FAKTOR_LABEL_DATA);
}

/**
 * Tooltip sorot simpul. `float-tooltip` (dipakai force-graph) menulis string lewat `.html()` = innerHTML; nama simpul
 * berasal dari judul chat (awal pesan, bisa tempelan web), nama berkas, dan ringkasan memori buatan model. Di desktop
 * CSP dibuang saat build dan di web CSP mengizinkan 'unsafe-inline' → `<img onerror=…>` di nama akan BERJALAN di
 * renderer yang memegang `window.electronAPI`. Maka nama di-escape: tampil sebagai teks, tak pernah sebagai HTML.
 */
export function labelTooltipAman(node) {
  return String(node?.name ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/**
 * Prioritas label (kecil = lebih penting). Label dilukis di AKHIR bingkai menurut urutan ini (ActivityGraph
 * onRenderFramePost); label yang akan menindih label yang sudah dilukis DILEWATI — simpulnya tetap tampil & namanya
 * terbaca lewat sorot. Diputuskan 2 Nov (Tahap E) sesudah penyetelan gaya terbukti tak bisa menjamin 15 label kerangka
 * selalu muat: tiap pasang yang dibereskan memunculkan pasang lain di keadaan lain (urutan alat, ekor pesan, layar).
 */
export const PRIORITAS_LABEL = Object.freeze({ pusat: 0, kemampuan: 1, fondasi: 2, lapisan: 3, konektor: 4, konflik: 5, data: 6 });
export const prioritasLabel = (n) => (n?.isConflict ? PRIORITAS_LABEL.konflik : (PRIORITAS_LABEL[n?.group] ?? PRIORITAS_LABEL.data));

/**
 * Kotak label [x0, y0, x1, y1] di titik (x, y) selebar `lebar`: tengah (bawaan), 'kiri' = berakhir di x, 'kanan' = mulai
 * di x; `atas` = teks berakhir di y (label di atas simpul — planet di belahan atas tata surya, Tahap F).
 */
export function kotakLabel(x, y, lebar, tinggi, arah, atas = false) {
  const x0 = arah === 'kiri' ? x - lebar : arah === 'kanan' ? x : x - lebar / 2;
  const y0 = atas ? y - tinggi : y;
  return [x0, y0, x0 + lebar, y0 + tinggi];
}

/**
 * Titik jangkar label simpul di kanvas. Simpul tata surya membawa `labelGeser` (di luar sistem bulannya, Tahap F);
 * lainnya di bawah simpul seperti dulu. `celah` = 2,5 px layar dalam satuan graf.
 */
export function jangkarLabel(node, jari, celah) {
  if (node?.labelGeser) {
    const [gx, gy] = node.labelGeser;
    return { x: node.x + gx, y: node.y + gy + (node.labelAtas ? -celah : celah), arah: node.labelArah, atas: !!node.labelAtas };
  }
  return { x: node.x, y: node.y + jari + celah, arah: node.labelArah, atas: false };
}

/** Kotak [x0, y0, x1, y1] boleh dilukis bila tak menindih yang sudah terpakai; bila boleh, ia ikut dicatat terpakai. */
export function bolehLabel(kotak, terpakai) {
  if (terpakai.some((t) => kotak[0] < t[2] && t[0] < kotak[2] && kotak[1] < t[3] && t[1] < kotak[3])) return false;
  terpakai.push(kotak);
  return true;
}

/** Urutan lukis simpul: data dulu, kerangka sesudahnya (titik kerangka di atas awan data), kerangka menurut prioritas. */
export function urutLukis(nodes) {
  const p = (n) => (n.isCategory ? 1 + prioritasLabel(n) : 0);
  return nodes.sort((a, b) => p(a) - p(b));
}

/** Warna lampu layanan. UNKNOWN = abu-abu ("tak ada sinyal"), BUKAN merah — merah hanya untuk bukti kegagalan. */
export function warnaStatus(status) {
  return { HEALTHY: '#22c55e', DEGRADED: '#eab308', DOWN: '#ef4444' }[status] || '#94a3b8';
}

/**
 * Lampu gabungan (fondasi, jalur pesan) = status TERBURUK yang diketahui. UNKNOWN tidak menggelapkan yang diketahui
 * (OpenRouter: penyedia DEGRADED + embedding UNKNOWN → DEGRADED); UNKNOWN hanya bila tak satu pun diketahui.
 */
export function statusGabungan(kunci, vitals) {
  const ada = (kunci || []).map((k) => vitals?.[k]);
  return ['DOWN', 'DEGRADED', 'HEALTHY'].find((s) => ada.includes(s)) || 'UNKNOWN';
}

const JENDELA_EDGE_MS = 7 * 24 * 3600e3;
const JENDELA_PENYEDIA_MS = 30 * 24 * 3600e3;
const waktu = (t) => new Date(t).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * Lampu yang dulu menebak (Item 130 Tahap B, 2 Nov 2026) — dinilai dari sinyal yang SUDAH ada di basis data, tanpa
 * memanggil apa pun (dulu `functions.invoke('ping')` setiap buka Home):
 *
 * - `heartbeat` (`service_heartbeat`, ditulis agent-process SETIAP selesai melayani permintaan: HEALTHY/DOWN). DOWN
 *   berarti "permintaan terakhir gagal" — fungsinya hidup (dialah yang menulis baris itu). Dulu dibaca sebagai DOWN =
 *   mati → "SYSTEM STATUS: DOWN" sejak 30 Okt, padahal penyebabnya saldo penyedia.
 * - `suksesTerakhir` = panggilan model berhasil terakhir milik akun ini (`api_usage`, RLS milik sendiri).
 * - `galatPenyediaTerakhir` = `PROVIDER_ERROR` terakhir milik akun ini (`agent_logs`). Dulu penyedia dibaca dari
 *   `ai_system_logs` yang 0 baris → selalu hijau.
 * - Embedding: TIDAK tercatat di `api_usage` (0 baris model embedding, diukur 2 Nov) → tak ada sinyal jujur → UNKNOWN.
 *   Dulu hijau hanya karena potongan dokumen lama ada.
 *
 * @returns {{ status: Record<string,string>, keterangan: Record<string,string> }}
 */
export function nilaiLampu({ heartbeat, suksesTerakhir, galatPenyediaTerakhir, desktop = false, sekarang = Date.now() } = {}) {
  const status = {}, keterangan = {};

  // Tahap C — fondasi Electron: ada `window.electronAPI` (preload) = Home sedang berjalan di aplikasi desktop.
  status.electron = desktop ? 'HEALTHY' : 'UNKNOWN';
  keterangan.electron = desktop ? 'berjalan di aplikasi desktop' : 'versi web — konektor MCP & alat folder hanya di desktop';
  const hb = heartbeat?.last_heartbeat_at ? new Date(heartbeat.last_heartbeat_at).getTime() : null;

  if (!hb) { status.agentProcess = 'UNKNOWN'; keterangan.agentProcess = 'belum ada catatan permintaan'; }
  else if (heartbeat.status === 'HEALTHY') { status.agentProcess = 'HEALTHY'; keterangan.agentProcess = `permintaan terakhir berhasil · ${waktu(hb)}`; }
  else { status.agentProcess = 'DEGRADED'; keterangan.agentProcess = `permintaan terakhir gagal · ${waktu(hb)} (fungsi menjawab; penyebab biasanya penyedia/saldo)`; }

  if (hb && sekarang - hb <= JENDELA_EDGE_MS) { status.edge = 'HEALTHY'; keterangan.edge = `agent-process menjawab · ${waktu(hb)}`; }
  else { status.edge = 'UNKNOWN'; keterangan.edge = 'tak ada permintaan 7 hari terakhir'; }

  const s = suksesTerakhir ? new Date(suksesTerakhir).getTime() : null;
  const g = galatPenyediaTerakhir ? new Date(galatPenyediaTerakhir).getTime() : null;
  const baru = (t) => t !== null && sekarang - t <= JENDELA_PENYEDIA_MS;
  if (!baru(s) && !baru(g)) { status.provider = 'UNKNOWN'; keterangan.provider = 'tak ada panggilan model 30 hari terakhir'; }
  else if (baru(g) && (s === null || g > s)) {
    status.provider = 'DEGRADED';
    keterangan.provider = `gagal terakhir · ${waktu(g)}${s !== null ? ` · berhasil terakhir · ${waktu(s)}` : ''}`;
  } else { status.provider = 'HEALTHY'; keterangan.provider = `berhasil terakhir · ${waktu(s)}`; }

  status.embedding = 'UNKNOWN';
  keterangan.embedding = 'tak ada sinyal — panggilan embedding tidak tercatat';
  return { status, keterangan };
}

/**
 * `agent_logs` untuk Home: tanpa `message` & `metadata` utuh (dulu `select('*')`, ±29 kB per buka Home, 11 kB dari
 * metadata) — hanya 5 nilai metadata yang dibaca (latensi & trace id), diambil di basis data lewat jalur JSON.
 */
export const KOLOM_LOG_AGEN = 'event_type, provider, created_at, latency_ms:metadata->latency_ms, '
  + 'execution_time_ms:metadata->execution_time_ms, duration_ms:metadata->duration_ms, '
  + 'trace_id:metadata->>trace_id, traceId:metadata->>traceId';

/** Memulihkan bentuk lama (`l.metadata?.latency_ms`, `l.metadata?.trace_id`) supaya pembaca di hook tak berubah. */
export function bentukLogAgen(baris) {
  return (baris || []).map(({ latency_ms, execution_time_ms, duration_ms, trace_id, traceId, ...l }) =>
    ({ ...l, metadata: { latency_ms, execution_time_ms, duration_ms, trace_id, traceId } }));
}

/** Status Realtime dari callback `channel.subscribe` — gratis, langganan yang memang dipakai Home. */
export function statusRealtime(s) {
  return { SUBSCRIBED: 'HEALTHY', TIMED_OUT: 'DEGRADED', CHANNEL_ERROR: 'DOWN', CLOSED: 'UNKNOWN' }[s] || 'UNKNOWN';
}

/**
 * Safely push a link only if both source and target nodes exist.
 * Prevents "node not found" / "Cannot create property 'vx' on string" errors.
 */
export function safeLink(links, nodes, source, target, extra = {}) {
  const sourceId = (typeof source === 'object' && source !== null) ? (source.id || source) : source;
  const targetId = (typeof target === 'object' && target !== null) ? (target.id || target) : target;
  if (!nodes.some(n => n.id === sourceId)) {
    console.warn(`[safeLink] Skipped — source node "${sourceId}" not found`);
    return;
  }
  if (!nodes.some(n => n.id === targetId)) {
    console.warn(`[safeLink] Skipped — target node "${targetId}" not found`);
    return;
  }
  links.push({ source, target, ...extra });
}

/**
 * Susunan graf Home — Item 130 Tahap C (Konstitusi 23 revisi 2 Nov 2026). Dulu bintang ke satu pusat "SUPABASE KERNEL"
 * dengan 5 cluster, 12 sub-cluster label kosong, dan 11 simpul layanan. Kini:
 *
 *   pusat      MAMET dua belahan (Desktop / Server), disambung "jalur pesan" (lampunya = permintaan terakhir)
 *   lingkar 1  kemampuan inti, bergaris ke belahan tempat KODENYA berjalan
 *   ekor       data → kemampuan pemakainya (dokumen → RAG, memori → Memori, percakapan → Chat/Engineer)
 *   fondasi    Supabase, OpenRouter, Electron — lampu gabungan dari vitals
 *
 * Arah garis = data → kemampuan → belahan → (desktop → server): sorotan jalur (HomeDashboard) menelusuri arah ini.
 */
export const PUSAT = Object.freeze({ desktop: 'mamet-desktop', server: 'mamet-server' });

export const KEMAMPUAN = Object.freeze([
  { id: 'kem-chat', name: 'Chat', belahan: ['desktop', 'server'] },
  { id: 'kem-rag', name: 'RAG Dokumen', belahan: ['server'] },
  { id: 'kem-tabel', name: 'Data Tabel ASN', belahan: ['desktop'] },
  { id: 'kem-engineer', name: 'Engineer', belahan: ['desktop', 'server'] },
  { id: 'kem-memori', name: 'Memori', belahan: ['server'] },
]);

export const FONDASI = Object.freeze([
  { id: 'fon-supabase', name: 'Supabase', statusKeys: ['supabase', 'auth', 'storage', 'realtime', 'edge', 'memory', 'rag'], belahan: ['desktop', 'server'] },
  { id: 'fon-openrouter', name: 'OpenRouter', statusKeys: ['provider', 'embedding'], belahan: ['server'] },
  { id: 'fon-electron', name: 'Electron', statusKeys: ['electron'], belahan: ['desktop'] },
]);

/** Percakapan Engineer (juga nama lama `OWNER`/`ws-owner`) → Engineer; selebihnya (Assistant, Lite, Agent Forge) → Chat. */
export function kemampuanPercakapan(workspaceType) {
  const w = String(workspaceType || '').toLowerCase().replace(/^ws-/, '');
  return w === 'engineer' || w === 'owner' ? 'kem-engineer' : 'kem-chat';
}

/**
 * Baris `hitungan_graf_home()` (Tahap E) → peta angka. 'pemakaian_model' = total baris api_usage akun — panel "LLM CALLS"
 * dulu menghitung baris kueri ber-limit 100, jadi selalu 100.
 * @returns {{ pesanPerChat: Record<string, number>, docChunkCounts: Record<string, number>, pemakaianModel: number|null }}
 */
export function bacaHitunganGraf(baris) {
  const pesanPerChat = {}, docChunkCounts = {};
  let pemakaianModel = null;
  (Array.isArray(baris) ? baris : []).forEach((b) => {
    const n = Number(b?.jumlah);
    if (!Number.isFinite(n)) return;
    if (b.jenis === 'pesan' && b.id) pesanPerChat[b.id] = n;
    else if (b.jenis === 'potongan' && b.id) docChunkCounts[b.id] = n;
    else if (b.jenis === 'pemakaian_model') pemakaianModel = n;
  });
  return { pesanPerChat, docChunkCounts, pemakaianModel };
}

/** Ukuran simpul percakapan dari jumlah pesannya (Tahap E, `hitungan_graf_home`); tanpa hitungan → 8 seperti dulu. */
export function ukuranPercakapan(jumlahPesan) {
  return Number.isFinite(jumlahPesan) ? Math.max(4, Math.min(24, 4 + jumlahPesan * 0.3)) : 8;
}

export function susunGrafHome({ memories, documents, chats, docChunkCounts, vitals = {}, pesanPerChat = {} }) {
  const nodes = [];
  const links = [];

  // ── Pusat: dua belahan, posisi dipaku ──────────────────────────────────────────────────────────
  // `labelArah` (Tahap E): label belahan diratakan KE LUAR (Desktop ke kiri, Server ke kanan), bukan di tengah simpul —
  // jarak antar-label berlipat tanpa memindahkan simpul. Diukur: di 768 px dengan lapisan + ekor menyala, label tengah
  // "MAMET · SERVER" tertabrak "MAMET · DESKTOP" dan disembunyikan.
  // Tahap F: bintang ganda tata surya (posisi akhir dari `tataSurya`; nilai di sini sama).
  nodes.push({ id: PUSAT.desktop, name: 'MAMET · DESKTOP', type: 'Belahan', group: 'pusat', val: 30, color: '#ffffff', isCategory: true, fx: -ORBIT.jarakBintang, fy: 0, labelArah: 'kiri' });
  nodes.push({ id: PUSAT.server, name: 'MAMET · SERVER', type: 'Belahan', group: 'pusat', val: 30, color: '#ffffff', isCategory: true, fx: ORBIT.jarakBintang, fy: 0, labelArah: 'kanan' });

  // ── Lingkar 1 & fondasi ────────────────────────────────────────────────────────────────────────
  KEMAMPUAN.forEach((k) => nodes.push({ id: k.id, name: k.name, type: 'Kemampuan', group: 'kemampuan', val: 20, color: '#38bdf8', isCategory: true }));
  FONDASI.forEach((f) => {
    const status = statusGabungan(f.statusKeys, vitals);
    nodes.push({ id: f.id, name: f.name, type: 'Fondasi', group: 'fondasi', val: 14, color: warnaStatus(status), statusKeys: f.statusKeys, isCategory: true, status });
  });

  // ── Data (bentuk & ukuran sama dengan sebelum Tahap C) ─────────────────────────────────────────
  memories.forEach(m => {
    const hits = m.memory_hits || 0;
    const causalLinks = m.causal_links || [];
    let relationsCount = causalLinks.length;
    const sourceChatId = m.metadata?.chat_id || m.metadata?.source_id;
    const sourceDocId = m.metadata?.document_id;
    if (sourceChatId) relationsCount++;
    if (sourceDocId) relationsCount++;
    const isConflict = m.status === 'CONFLICT_PENDING_REVIEW' || m.metadata?.status === 'CONFLICT_PENDING_REVIEW';
    nodes.push({
      id: `mem-${m.id}`,
      name: m.summary || 'Memory',
      type: 'Memory',
      group: 'memory',
      isConflict,
      val: isConflict ? 14 : Math.max(3, Math.min(25, 3 + hits * 2)),
      color: isConflict ? '#ef4444' : '#22c55e',
      data: { created: m.created_at, used: hits, relations: relationsCount, status: m.status, metadata: m.metadata || {} }
    });
  });

  documents.forEach(d => {
    const chunkCount = docChunkCounts[d.id] || 0;
    nodes.push({
      id: `doc-${d.id}`,
      name: d.title || 'Document',
      type: 'Document',
      group: 'rag',
      val: Math.max(3, Math.min(25, 3 + chunkCount * 0.5)),
      color: '#a855f7',
      data: { created: d.created_at, used: 'N/A', relations: chunkCount, metadata: d.metadata || {} }
    });
  });

  chats.forEach(c => {
    const jumlahPesan = pesanPerChat[c.id];
    nodes.push({
      id: `chat-${c.id}`,
      name: c.title || 'Chat',
      type: 'Conversation',
      group: 'chat',
      val: ukuranPercakapan(jumlahPesan),
      color: '#eab308',
      data: { created: c.created_at, used: 1, source: c.workspace_type, relations: 1, ...(Number.isFinite(jumlahPesan) ? { pesan: jumlahPesan } : {}) }
    });
  });

  // ── Garis ──────────────────────────────────────────────────────────────────────────────────────
  // Jalur pesan: lampunya = permintaan terakhir agent-process (nilaiLampu).
  safeLink(links, nodes, PUSAT.desktop, PUSAT.server, { statusKeys: ['agentProcess'], jalurPesan: true, width: 3 });
  KEMAMPUAN.forEach((k) => k.belahan.forEach((b) => safeLink(links, nodes, k.id, PUSAT[b])));
  FONDASI.forEach((f) => f.belahan.forEach((b) => safeLink(links, nodes, f.id, PUSAT[b], { statusKeys: f.statusKeys })));

  memories.forEach(m => {
    // Memori SELALU ekor dari Memori — dulu memori tanpa relasi dibiarkan melayang (10 dari 10 milik Owner).
    safeLink(links, nodes, `mem-${m.id}`, 'kem-memori');
    (m.causal_links || []).forEach(targetId => safeLink(links, nodes, `mem-${targetId}`, `mem-${m.id}`));
    const sourceChatId = m.metadata?.chat_id || m.metadata?.source_id;
    const sourceDocId = m.metadata?.document_id;
    if (sourceChatId && chats.some(c => c.id === sourceChatId)) safeLink(links, nodes, `chat-${sourceChatId}`, `mem-${m.id}`);
    if (sourceDocId && documents.some(d => d.id === sourceDocId)) safeLink(links, nodes, `doc-${sourceDocId}`, `mem-${m.id}`);
  });
  documents.forEach(d => safeLink(links, nodes, `doc-${d.id}`, 'kem-rag'));
  chats.forEach(c => safeLink(links, nodes, `chat-${c.id}`, kemampuanPercakapan(c.workspace_type)));

  // Kerangka (pusat, kemampuan, fondasi) PALING AKHIR: force-graph melukis simpul menurut urutan daftar, dan label
  // digambar bersama simpulnya — dulu ratusan titik data dilukis SESUDAH label kemampuan dan menimbunnya
  // ("RAG Dokume●", tangkapan layar Owner 2 Nov). Urutan stabil: urutan di dalam tiap golongan tidak berubah.
  urutLukis(nodes);

  // ── Statistik (definisi tidak berubah) ─────────────────────────────────────────────────────────
  const orphanCount = nodes.filter(n => !n.isCategory && n.data && n.data.relations === 0).length;
  const totalDataNodes = nodes.filter(n => !n.isCategory && n.data).length;
  const stats = {
    memories: memories.length,
    documents: documents.length,
    chats: chats.length,
    orphans: orphanCount,
    connected: totalDataNodes - orphanCount,
    memoryConflicts: memories.filter(m => m.status === 'CONFLICT_PENDING_REVIEW').length
  };

  return { nodes, links, stats };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// Lapisan Kemampuan (Item 130 Tahap D, Konstitusi 23 "lingkar 2") — dibuka lewat tombol, tidak selalu tampil.
// Sumbernya daftar RESMI, bukan karangan: registry alat chat (`tools/`), `shared/folderKerjaAlat.js`,
// `shared/konektorAlat.js` + status konektor desktop (baca-saja), `shared/daftarSubagen.js`. Semuanya di laptop —
// menampilkannya tak memanggil jaringan sama sekali.
// ═════════════════════════════════════════════════════════════════════════════════════════════════

export const WARNA_ALAT = Object.freeze({ aktif: '#7dd3fc', mati: '#64748b' });

/**
 * Status konektor dari `electronAPI.konektor.status()` dipangkas ke yang ditampilkan graf. Baris aslinya juga memuat
 * pid, ringkasan katalog, dan keadaan komponen stealth — tak ada urusannya dengan graf, jadi tak dibawa.
 * @returns {Array<{ id: string, nama: string, workspace: string, diaktifkan: boolean, menyala: boolean, alat: string[] }>}
 */
export function konektorUntukGraf(baris) {
  return (Array.isArray(baris) ? baris : []).map((b) => ({
    id: String(b?.konektor ?? ''),
    nama: String(b?.nama ?? b?.konektor ?? ''),
    workspace: String(b?.workspace ?? ''),
    diaktifkan: b?.diaktifkan === true,
    menyala: b?.status === 'nyala',   // konektorMcp.cjs: 'nyala' | 'mati' | 'berhenti'
    alat: Array.isArray(b?.alat) ? b.alat.map(String) : [],
  })).filter((k) => k.id);
}

/**
 * Server MCP UMUM (Item 129 Tahap G3, titik sambung S8) ikut lapisan MCP: status baca-saja `konektorUmum.status()` →
 * tambahan `konektorDikenal` (nama + alat yang DISETUJUI Owner) dan baris per workspace dengan bentuk yang sama
 * dengan `konektorUntukGraf`. Tanpa ini graf hanya mengenal crawler dan server yang dipasang Owner tak pernah tampil.
 * @returns {{konektorDikenal: object, konektor: Array|null}}
 */
export function gabungKonektorUmum(konektorDikenal, konektor, statusUmum) {
  const umum = Array.isArray(statusUmum) ? statusUmum.filter((s) => s && typeof s.id === 'string' && s.id) : [];
  if (!umum.length) return { konektorDikenal, konektor };
  const dikenal = { ...konektorDikenal };
  const baris = [...(konektor || [])];
  for (const s of umum) {
    if (dikenal[s.id]) continue; // id bawaan tak boleh ditimpa
    dikenal[s.id] = { nama: String(s.nama || s.id), alat: Array.isArray(s.alatDisetujui) ? s.alatDisetujui.map(String) : [] };
    for (const [ws, w] of Object.entries(s.ws || {})) {
      baris.push({ id: s.id, nama: String(s.nama || s.id), workspace: ws, diaktifkan: w?.diaktifkan === true, menyala: w?.status === 'nyala', alat: Array.isArray(w?.alat) ? w.alat.map(String) : [] });
    }
  }
  return { konektorDikenal: dikenal, konektor: baris };
}

/**
 * @param {{ alatChat: Array<{name: string, aktif: boolean}>, alatFolder: string[],
 *           konektorDikenal: Record<string, {nama: string, alat: string[]}>, konektor: Array|null,
 *           subagen: Array<{nama: string, label: string, khususPemilik: boolean}> }} sumber
 *   `konektor` null = bukan desktop (web): MCP tak tersedia, ditandai "hanya desktop".
 * @returns {{ nodes: Array, links: Array }} untuk digabung ke graf dasar lewat `gabungGraf`
 */
export function susunLapisanKemampuan({ alatChat = [], alatFolder = [], konektorDikenal = {}, konektor = null, subagen = [] } = {}) {
  const nodes = [], links = [];
  const simpul = (n) => { nodes.push(n); return n.id; };
  const garis = (s, t) => links.push({ source: s, target: t });
  const hub = (id, name) => simpul({ id, name, type: 'Lapisan', group: 'lapisan', val: 12, color: '#38bdf8', isCategory: true });
  const alat = (id, name, aktif, induk) => {
    simpul({ id, name: aktif ? name : `${name} · nonaktif`, type: 'Alat', group: 'alat', val: 4, color: aktif ? WARNA_ALAT.aktif : WARNA_ALAT.mati, aktif });
    garis(id, induk);
  };

  // Alat chat (panel Tools Assistant). Alat yang ADALAH sebuah kemampuan inti ikut bergaris ke kemampuannya.
  const hChat = hub('lap-alat-chat', `Alat chat · ${alatChat.length}`);
  garis(hChat, 'kem-chat');
  const kemampuanAlat = { data_tabel: 'kem-tabel', memory_manager: 'kem-memori' };
  alatChat.forEach((a) => {
    const id = `alat-chat-${a.name}`;
    alat(id, a.name, a.aktif !== false, hChat);
    if (kemampuanAlat[a.name]) garis(id, kemampuanAlat[a.name]);
  });

  // Alat folder kerja — Assistant (tombol 📁) & Engineer, dijalankan desktop.
  const hFolder = hub('lap-alat-folder', `Alat folder · ${alatFolder.length}`);
  garis(hFolder, 'kem-chat');
  garis(hFolder, 'kem-engineer');
  alatFolder.forEach((n) => alat(`alat-folder-${n}`, n, true, hFolder));

  // MCP berekor: MCP → konektor → alat. Konektor baru di `KONEKTOR`/`KONEKTOR_DIKENAL` muncul sendiri.
  const desktop = Array.isArray(konektor);
  const daftarKonektor = Object.keys(konektorDikenal);
  const hMcp = hub('lap-mcp', desktop ? `MCP · ${daftarKonektor.length} konektor` : 'MCP · hanya desktop');
  garis(hMcp, 'kem-chat');
  garis(hMcp, 'kem-engineer');
  // Server MCP berjalan sebagai proses Electron (konektorMcp.cjs, proses utama) — relasi nyata, sekaligus yang
  // membedakan letaknya dari "Alat folder" (diukur: tanpa garis ini keduanya saling tindih di layar Owner).
  garis(hMcp, 'fon-electron');
  if (desktop) {
    daftarKonektor.forEach((kid) => {
      const baris = konektor.filter((k) => k.id === kid);
      const diaktifkan = baris.some((k) => k.diaktifkan);
      const id = `lap-konektor-${kid}`;
      // Grup 'lapisan' (ikut cincin lapisan). Dicoba grup sendiri tanpa cincin (2 Nov): hub "MCP" malah tersembunyi di 7
      // dari 15 keadaan — lebih buruk; tindih MCP/konektor yang tersisa ditangani penghindar tabrakan label.
      simpul({ id, name: diaktifkan ? konektorDikenal[kid].nama : `${konektorDikenal[kid].nama} · mati`, type: 'Konektor', group: 'lapisan', val: 10,
        color: diaktifkan ? '#38bdf8' : WARNA_ALAT.mati, isCategory: true, aktif: diaktifkan });
      garis(id, hMcp);
      // Alat dari server MCP yang sedang menyala; bila mati, daftar alat yang dikenal (`shared/konektorAlat.js`).
      const nyata = [...new Set(baris.flatMap((k) => k.alat))];
      (nyata.length ? nyata : konektorDikenal[kid].alat).forEach((n) => alat(`alat-mcp-${kid}-${n}`, n, diaktifkan, id));
    });
  }

  // Sub-agent server (daftar resmi `shared/daftarSubagen.js`) — berjalan di belahan Server.
  const hSub = hub('lap-subagen', `Sub-agent · ${subagen.length}`);
  garis(hSub, 'mamet-server');
  subagen.forEach((s) => {
    const id = `alat-sub-${s.nama}`;
    simpul({ id, name: s.khususPemilik ? `${s.label} · terkunci` : s.label, type: 'Sub-agent', group: 'alat', val: 4,
      color: s.khususPemilik ? WARNA_ALAT.mati : WARNA_ALAT.aktif, aktif: !s.khususPemilik });
    garis(id, hSub);
  });

  return { nodes, links };
}

/** Graf dasar + lapisan (boleh lebih dari satu; null dilewati), tanpa mengubah graf dasar. Kerangka tetap dilukis terakhir. */
export function gabungGraf(dasar, ...lapisan) {
  const ada = lapisan.filter(Boolean);
  if (!ada.length) return dasar;
  const nodes = urutLukis([...dasar.nodes, ...ada.flatMap((l) => l.nodes)]);
  return { nodes, links: [...dasar.links, ...ada.flatMap((l) => l.links)] };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// Ekor pesan (Item 130 Tahap E) — satu percakapan, dimuat SAAT DIKLIK lewat `pesan_percakapan_graf` (migrasi
// 20261102000000). Baris berisi urutan, peran, cuplikan 80 huruf, dan KODE alat yang diturunkan basis data dari angka &
// penanda (rag, web, memori, nama alat/sub-agent) — teks konteks & memori tak pernah sampai ke klien.
// ═════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Kode alat → simpul yang ada di graf sekarang. Garis hanya digambar ke simpul yang ADA (lapisan Kemampuan bisa mati);
 * kode yang tak dikenal (mis. `knowledge_manager`, sub-agent lama yang dihapus T9) tak bergaris — tetap tercantum di nama.
 */
export function simpulAlat(kode, idAda) {
  const calon = {
    rag: ['kem-rag'],
    memori: ['kem-memori'],
    web: ['alat-chat-web_search', 'alat-sub-researcher'],
  }[kode] || [`alat-chat-${kode}`, `alat-sub-${kode}`, `alat-folder-${kode}`];
  return calon.find((id) => idAda.has(id)) || null;
}

/**
 * @param {string} chatId id simpul percakapan (`chat-…`)
 * @param {Array<{urutan: number, peran: string, cuplikan: string, alat: string[]}>} baris hasil `pesan_percakapan_graf`
 * @param {Set<string>} idAda id simpul yang sedang ada di graf (dasar + lapisan)
 */
export function susunEkorPesan(chatId, baris, idAda) {
  const nodes = [], links = [];
  (Array.isArray(baris) ? baris : []).forEach((b) => {
    const id = `pesan-${chatId}-${b.urutan}`;
    const alat = Array.isArray(b.alat) ? b.alat : [];
    const pengguna = b.peran === 'user';
    nodes.push({
      id,
      name: `${pengguna ? 'Anda' : 'Mamet'} · ${b.cuplikan || '(kosong)'}${alat.length ? ` [${alat.join(', ')}]` : ''}`,
      type: 'Pesan', group: 'pesan', val: 2.5,
      color: pengguna ? '#fde68a' : '#eab308',
      data: { urutan: b.urutan, peran: b.peran, alat },
    });
    links.push({ source: id, target: chatId });
    alat.forEach((k) => {
      const tujuan = simpulAlat(k, idAda);
      if (tujuan) links.push({ source: id, target: tujuan, jalurAlat: true });
    });
  });
  return { nodes, links };
}
