"""Wajah MCP (ADR-CRW-0005, ADR-CRW-0006): perintah lewat chat Claude Code / Claude Desktop.

Claude bertindak sebagai perencana: perintah bebas Owner diubah menjadi Misi terstruktur. Crawler tetap tidak
menafsirkan apa pun (ADR-CRW-0003). Misi berjalan di thread latar; jalankan_misi menunggu sebentar lalu
mengembalikan hasil, atau misi_id bila masih berjalan (eksekusi asinkron, ADR-CRW-0003 butir 6).

Jalankan: crawler-mcp   (stdio; stdout dipakai protokol MCP, log ke stderr)
"""

import logging
import sys
import threading

import anyio
from mcp.server.mcpserver import MCPServer

from crawler import NAMA, __version__, konfig
from crawler.capability import EcosystemCrawler
from crawler.gudang.ekspor import FORMAT, ekspor
from crawler.inti.model import Misi, MisiTidakValid
from crawler.inti.teks import tanggal_relatif

log = logging.getLogger("crawler.mcp")

INSTRUKSI = """\
Ecosystem Crawler adalah indra dan tangan: ia hanya mencari, mengambil, dan menyimpan data mentah. Anda (Claude)
adalah perencananya.

Alur kerja:
1. Panggil `katalog` untuk melihat sumber yang tersedia, kanalnya, dan cocok_untuk apa.
2. Ubah perintah bebas Owner menjadi misi: pilih sumber yang relevan, susun kata kunci dalam bahasa yang dipakai
   orang di sumber itu (termasuk sinonim dan istilah sehari-hari), tentukan rentang waktu dan batas jumlah. Isi
   owner_intent dengan perintah asli Owner.
3. Panggil `jalankan_misi`. Bila statusnya masih "berjalan", tunggu lalu panggil `status_misi`.
4. Baca hasil dengan `baca_tangkapan` (berhalaman, pakai kursor), lalu analisis di chat bila Owner memintanya.
5. Tawarkan `ekspor_misi` bila Owner ingin membuka hasilnya di Excel atau editor.

Aturan:
- Data hasil crawler berstatus hypothesis: data mentah, bukan kebenaran. Sebutkan sumber dan link saat mengutip.
- Penulis ditampilkan sebagai pseudonim (p_...). Jangan mencoba mengungkap identitas di baliknya.
- Fokus pada isu dan pola, bukan pada individu.
- Cara crawler mengakses halaman adalah sakelar Owner yang bisa berubah (ADR-CRW-0010): apakah crawler mematuhi
  robots.txt, dan apakah tingkat stealth (browser yang menyamarkan sidik jarinya) dipakai untuk halaman publik yang memblokir.
  Keadaannya saat ini ada di `akses` pada hasil `katalog`. Jangan menyebut keadaan sakelar dari ingatan atau dari
  aturan lama; bacalah `akses`. Yang selalu berlaku: crawler tidak menjawab CAPTCHA/tantangan yang sudah muncul, dan
  tidak memakai akun orang lain.
- Sumber rss_media hanya memuat berita terbaru dari Detik, CNN Indonesia, dan Antara. Untuk berita yang lebih lama
  atau spesifik, cari link-nya dengan mesin pencari Anda lalu kirim ke sumber web lewat url_awal.
- Suara langsung masyarakat ada di mediakonsumen (surat pembaca keluhan konsumen), arctic_shift/reddit (diskusi),
  youtube (komentar), kaskus, bluesky, dan inbox.
- Sumber kaskus dan web tidak bisa mencari sendiri. Cari dulu link-nya dengan mesin pencari Anda (mis.
  "site:kaskus.co.id <topik>"), lalu kirim lewat url_awal.
- Sumber yang kesehatannya bukan "siap" (mis. youtube tanpa kunci API, reddit tanpa kredensial) jangan dipakai.
- Di bluesky banyak akun robot yang hanya mengulang judul berita. Akun *-poster.bsky.social dibuang secara default;
  isi opsi_sumber {"bluesky": {"kecualikan_penulis": []}} hanya bila Owner ingin melihatnya. Tanpa login, Bluesky
  hanya memberi halaman pertama pencarian (100 postingan per kata kunci).
- Mulai dengan batas kecil (mis. 30-50 per sumber), lalu perbesar bila hasilnya menjanjikan.
"""

server = MCPServer(name=NAMA, version=__version__, instructions=INSTRUKSI)

_berjalan: dict[str, threading.Thread] = {}


def _ringkas(t: dict, panjang_teks: int) -> dict:
    teks = t["teks"] or ""
    return {
        "id": t["id"], "sumber": t["sumber"], "jenis": t["jenis"], "judul": t["judul"],
        "teks": teks[:panjang_teks] + ("…" if len(teks) > panjang_teks else ""),
        "url": t["url"], "waktu_terbit": t["waktu_terbit"], "penulis": t["penulis_hash"],
        "metrik": {k: v for k, v in t["metrik"].items() if v not in (None, "", 0)},
        "parent_id": t["parent_id"], "kata_kunci_cocok": t["kata_kunci_cocok"],
    }


def _status(misi_id: str) -> dict:
    with EcosystemCrawler() as c:
        m = c.gudang.misi(misi_id)
        if not m:
            return {"error": f"misi {misi_id} tidak ditemukan"}
        if m["status"] == "berjalan":
            if misi_id not in _berjalan:
                return {"misi_id": misi_id, "status": "berjalan",
                        "catatan": "tidak berjalan di proses ini; mungkin terhenti saat server MCP ditutup"}
            return {"misi_id": misi_id, "status": "berjalan", "sudah_tersimpan": c.gudang.jumlah(misi_id),
                    "catatan": "panggil status_misi lagi sebentar lagi"}
        return m["ringkasan"] or {"misi_id": misi_id, "status": m["status"]}


@server.tool()
def katalog() -> dict:
    """Daftar sumber yang bisa dipakai misi: kanal (tv/laptop/hp), kemampuan, cocok_untuk, kesehatan, opsi khusus,
    dan tool asli yang dibungkus. Panggil ini sebelum menyusun misi."""
    with EcosystemCrawler() as c:
        status = c.report_status()
    return {
        "sumber": [{k: s[k] for k in ("id", "kanal", "jenis_akses", "kemampuan", "cocok_untuk", "aktif",
                                      "kesehatan", "butuh_kredensial", "batas_laju", "confidence_dasar")}
                   for s in status["katalog"]],
        "opsi_sumber": {
            "rss_media": {"media": "pilih dari detik, detik_finance, cnnindonesia, cnnindonesia_ekonomi, antara "
                                   "(default semua)", "ambil_isi": "true = ambil isi lengkap artikel",
                          "maks_isi": "default 20", "feed": "daftar URL RSS tambahan"},
            "mediakonsumen": {"tag": "slug tag, mis. ['bpjs-kesehatan', 'pinjol']; default dari kata kunci",
                              "kategori": "slug kategori", "halaman": "halaman feed per tag, default 3",
                              "halaman_cadangan": "bila tag tidak ada: halaman feed utama yang disaring kata "
                                                  "kunci, default 5",
                              "ambil_isi": "default true (isi lengkap surat)"},
            "arctic_shift": {"subreddit": "daftar subreddit, default ['indonesia']",
                             "maks_utas_komentar": "default 10"},
            "reddit": {"subreddit": "mis. 'indonesia' atau 'indonesia+finansial' (default 'all')",
                       "urut": "relevance | new | top"},
            "bluesky": {"lang": "kode bahasa postingan, default bahasa misi", "urut": "latest | top"},
            "youtube": {"video_per_kata_kunci": "default 5 (100 unit kuota per kata kunci)",
                        "komentar_per_video": "default 30 (perlu ambil_komentar)",
                        "urut": "relevan (default) | terbaru", "urut_komentar": "top (default) | new"},
            "kaskus": {"catatan": "hanya dari url_awal; mengambil postingan pembuka thread dan jumlah balasannya"},
            "web": {"catatan": "hanya dari url_awal; isi utama halaman diekstrak; robots.txt mengikuti sakelar "
                               "(lihat akses)"},
            "inbox": {"saring_kata_kunci": "default true", "berkas": "pola nama berkas, mis. 'x_*.txt'"},
            "semua_sumber": {"kecualikan_penulis": "pola glob nama penulis yang dibuang, mis. ['*-poster.bsky.social']"},
        },
        "akses": akses(status["patuhi_robots"], status["stealth"]),
        "versi": f"{status['name']} {status['version']}",
    }


def akses(patuhi_robots: bool, stealth: bool) -> dict:
    """Keadaan sakelar akses saat ini (ADR-CRW-0010), dibaca dari .env saat server mulai — bukan teks tetap.

    Dulu instruksi server menulis "robots.txt dipatuhi … tidak menyamar" sebagai fakta tetap (aturan ADR-CRW-0009),
    padahal sakelarnya sudah ada dan bawaannya mati. AI yang membaca teks itu akan memberi tahu Owner hal yang salah."""
    return {
        "patuhi_robots": patuhi_robots,
        "stealth": stealth,
        "keterangan": (
            f"robots.txt {'dipatuhi' if patuhi_robots else 'TIDAK dipatuhi'} (sakelar CRAWLER_PATUHI_ROBOTS). "
            + ("Tingkat stealth NYALA: halaman publik yang memblokir dicoba lagi dengan browser yang menyamarkan "
               "sidik jarinya, bila Scrapling dan browser-nya terpasang (sakelar CRAWLER_STEALTH)."
               if stealth else "Tingkat stealth MATI: halaman yang memblokir dilewati (sakelar CRAWLER_STEALTH).")
            + " Crawler tidak menjawab CAPTCHA/tantangan yang sudah muncul dan tidak memakai akun orang lain."
        ),
    }


@server.tool()
async def jalankan_misi(
    sumber: list[str],
    kata_kunci: list[str] | None = None,
    url_awal: list[str] | None = None,
    owner_intent: str = "",
    kata_kunci_kecuali: list[str] | None = None,
    sejak: str = "",
    sampai: str = "",
    batas_per_sumber: int = 50,
    batas_total: int = 300,
    ambil_komentar: bool = False,
    kedalaman_komentar: int = 1,
    opsi_sumber: dict | None = None,
    bahasa: str = "id",
    wilayah: str = "ID",
    tunggu_detik: int = 60,
) -> dict:
    """Jalankan satu misi pengumpulan data.

    sumber: id dari `katalog`, mis. ["rss_media", "arctic_shift"]. Wajib dipilih eksplisit.
    kata_kunci: frasa pencarian; frasa berisi spasi dicari persis.
    url_awal: link langsung untuk sumber kaskus, web, dan youtube (hasil mesin pencari Anda).
    owner_intent: perintah asli Owner (disimpan sebagai jejak, tidak ditafsirkan).
    sejak / sampai: '30h' (hari), '12mg' (minggu), '6b' (bulan), atau 'YYYY-MM-DD'.
    opsi_sumber: pengaturan per sumber, lihat `katalog`, mis. {"reddit": {"subreddit": "indonesia"}}.
    tunggu_detik: lama menunggu hasil (maks 110). Bila misi belum selesai, kembalikan misi_id; cek dengan
    `status_misi`. Identitas asli penulis tidak bisa dibuka lewat chat; Owner memakai CLI --buka-identitas.
    """
    try:
        misi = Misi(
            sumber=sumber, kata_kunci=kata_kunci or [], url_awal=url_awal or [],
            kata_kunci_kecuali=kata_kunci_kecuali or [],
            dari=tanggal_relatif(sejak), sampai=tanggal_relatif(sampai), batas_per_sumber=batas_per_sumber,
            batas_total=batas_total, ambil_komentar=ambil_komentar, kedalaman_komentar=kedalaman_komentar,
            opsi_sumber=opsi_sumber or {}, bahasa=[bahasa], wilayah=wilayah, owner_intent=owner_intent,
            trace_id="",
        )
        with EcosystemCrawler() as c:
            tidak_dikenal = [s for s in sumber if s not in c.registri]
        if tidak_dikenal:
            raise MisiTidakValid(f"sumber tidak dikenal: {', '.join(tidak_dikenal)}")
    except (MisiTidakValid, ValueError) as exc:
        return {"error": str(exc)}

    def kerja():
        try:
            with EcosystemCrawler() as c:
                c.jalankan(misi)
        except Exception:
            log.exception("Misi %s gagal", misi.id)
        finally:
            _berjalan.pop(misi.id, None)

    thread = threading.Thread(target=kerja, name=f"misi-{misi.id}")
    _berjalan[misi.id] = thread
    thread.start()
    await anyio.to_thread.run_sync(thread.join, max(1, min(tunggu_detik, 110)))
    return _status(misi.id)


@server.tool()
def status_misi(misi_id: str) -> dict:
    """Status dan ringkasan per sumber sebuah misi (diambil, baru, gagal, alasan)."""
    return _status(misi_id)


@server.tool()
def daftar_misi(batas: int = 10) -> list[dict]:
    """Misi terbaru: id, waktu, status, sumber, kata kunci, dan perintah asli Owner."""
    with EcosystemCrawler() as c:
        return [{"misi_id": m["id"], "dibuat": m["dibuat"], "status": m["status"],
                 "sumber": m["spesifikasi"]["payload"]["sumber"],
                 "kata_kunci": m["spesifikasi"]["payload"]["kata_kunci"],
                 "owner_intent": m["spesifikasi"]["context"].get("owner_intent", "")}
                for m in c.gudang.daftar_misi(batas)]


@server.tool()
def baca_tangkapan(misi_id: str, kursor: int = 0, batas: int = 50, sumber: str = "",
                   panjang_teks: int = 600) -> dict:
    """Baca hasil misi per halaman. Mulai dengan kursor=0, lalu pakai `kursor_berikut` sampai `habis` bernilai
    true. Bisa disaring per sumber. Teks dipotong ke panjang_teks karakter; penulis berupa pseudonim."""
    batas = max(1, min(batas, 200))
    with EcosystemCrawler() as c:
        if not c.gudang.misi(misi_id):
            return {"error": f"misi {misi_id} tidak ditemukan"}
        items, kursor_baru = [], kursor
        while len(items) < batas:
            bagian, kursor_baru = c.gudang.baca(misi_id, kursor_baru, batas)
            if not bagian:
                break
            for t in bagian:
                if not sumber or t["sumber"] == sumber:
                    items.append(_ringkas(t, panjang_teks))
                if len(items) >= batas:
                    kursor_baru = t["urut"]
                    break
        habis = kursor_baru >= c.gudang.kursor_akhir(misi_id)
    return {"items": items, "kursor_berikut": kursor_baru, "habis": habis}


@server.tool()
def ekspor_misi(misi_id: str, format: list[str] | None = None) -> dict:
    """Simpan hasil misi ke berkas di folder hasil/: csv (Excel), jsonl (AI/skrip), md (daftar yang mudah dibaca).
    Kembalikan lokasi berkas agar Owner bisa membukanya."""
    formats = [f for f in (format or ["csv", "md"]) if f in FORMAT]
    with EcosystemCrawler() as c:
        try:
            paths = ekspor(c.gudang, misi_id, formats, konfig.HASIL_DIR)
        except KeyError as exc:
            return {"error": str(exc)}
    return {"berkas": [str(p) for p in paths]}


def main() -> None:
    # Di Windows stdin/stdout default cp1252: teks non-ASCII (★, emoji, ±) rusak atau error di protokol MCP.
    for s in (sys.stdin, sys.stdout, sys.stderr):
        s.reconfigure(encoding="utf-8")
    logging.basicConfig(level=logging.INFO, stream=sys.stderr, format="%(asctime)s [%(levelname)s] %(message)s")
    for nama in ("urllib3", "prawcore"):
        logging.getLogger(nama).setLevel(logging.WARNING)
    server.run("stdio")


if __name__ == "__main__":
    main()
