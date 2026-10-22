"""Wajah CLI (ADR-CRW-0006). Contoh:

    crawler katalog
    crawler cari "mutasi ASN" "PNS dimutasi" --sumber rss_media,arctic_shift,bluesky --sejak 90h --batas 100
    crawler misi jalankan misi/contoh-keluhan-asn.yaml
    crawler lihat <misi_id>
    crawler ekspor <misi_id> --format csv,md
"""

import argparse
import json
import logging
import sys
from pathlib import Path

import yaml

from crawler import konfig
from crawler.capability import EcosystemCrawler
from crawler.gudang.ekspor import FORMAT, ekspor
from crawler.inti.model import Misi, MisiTidakValid
from crawler.inti.teks import tanggal_relatif as _tanggal

log = logging.getLogger("crawler")


def _opsi(pasangan: list[str]) -> dict:
    """--opsi reddit.subreddit=indonesia --opsi mediakonsumen.tag=a,b  ->  {"reddit": {...}, ...}"""
    hasil: dict = {}
    for p in pasangan or []:
        kunci, _, nilai = p.partition("=")
        sumber, _, nama = kunci.partition(".")
        if not sumber or not nama:
            raise MisiTidakValid(f"format --opsi salah: '{p}' (contoh: reddit.subreddit=indonesia)")
        if "," in nilai:
            nilai = [v.strip() for v in nilai.split(",") if v.strip()]
        elif nilai.isdigit():
            nilai = int(nilai)
        elif nilai.lower() in ("true", "false"):
            nilai = nilai.lower() == "true"
        hasil.setdefault(sumber, {})[nama] = nilai
    return hasil


def _daftar(nilai: str) -> list[str]:
    return [s.strip() for s in (nilai or "").split(",") if s.strip()]


def _cetak_ringkasan(keluaran: dict) -> None:
    r = keluaran["result"]
    print(f"\nMisi {r['misi_id']}: {r['status']} · {r['total']} tangkapan · confidence {keluaran['confidence']}")
    for nama, h in r["per_sumber"].items():
        catatan = f" · {h['alasan']}" if h.get("alasan") else ""
        print(f"  {nama:<12} diambil {h['diambil']:>4} · baru {h['baru']:>4} · revisi {h['revisi']}{catatan}")


def _jalankan(crawler: EcosystemCrawler, misi: Misi, format_ekspor: str) -> None:
    keluaran = crawler.jalankan(misi)
    _cetak_ringkasan(keluaran)
    if format_ekspor:
        for p in ekspor(crawler.gudang, misi.id, _daftar(format_ekspor), konfig.HASIL_DIR):
            print(f"  -> {p}")
    print(f"\nLihat lagi: crawler lihat {misi.id}   ·   Ekspor: crawler ekspor {misi.id} --format csv,jsonl,md")


def cmd_cari(crawler: EcosystemCrawler, a) -> None:
    misi = Misi(
        sumber=_daftar(a.sumber), kata_kunci=a.kata_kunci, url_awal=a.url, kata_kunci_kecuali=_daftar(a.kecuali),
        dari=_tanggal(a.sejak), sampai=_tanggal(a.sampai), batas_per_sumber=a.batas, batas_total=a.total,
        ambil_komentar=a.komentar, kedalaman_komentar=a.kedalaman, buka_identitas_penulis=a.buka_identitas,
        opsi_sumber=_opsi(a.opsi), bahasa=_daftar(a.bahasa), wilayah=a.wilayah, owner_intent=a.intent,
    )
    _jalankan(crawler, misi, a.ekspor)


def cmd_misi(crawler: EcosystemCrawler, a) -> None:
    if a.aksi == "daftar":
        for m in crawler.gudang.daftar_misi(a.batas):
            p = m["spesifikasi"]["payload"]
            print(f"{m['id']}  {m['dibuat'][:16]}  {m['status']:<16} {','.join(p['sumber'])}  "
                  f"{', '.join(p['kata_kunci'])[:60]}")
        return
    if not a.berkas:
        sys.exit("Sebutkan berkas misi: crawler misi jalankan misi/nama.yaml")
    teks = Path(a.berkas).read_text(encoding="utf-8")
    data = json.loads(teks) if a.berkas.endswith(".json") else yaml.safe_load(teks)
    _jalankan(crawler, Misi.dari_input(data), a.ekspor)


def cmd_lihat(crawler: EcosystemCrawler, a) -> None:
    m = crawler.gudang.misi(a.misi_id)
    if not m:
        sys.exit(f"Misi {a.misi_id} tidak ditemukan. Lihat daftar: crawler misi daftar")
    _cetak_ringkasan({"result": m["ringkasan"] or {"misi_id": m["id"], "status": m["status"], "total": 0,
                                                   "per_sumber": {}},
                      "confidence": (m["ringkasan"] or {}).get("confidence", "-")})
    rows, _ = crawler.gudang.baca(a.misi_id, 0, a.contoh)
    if rows:
        print(f"\n{len(rows)} contoh pertama:")
        for r in rows:
            print(f"  [{r['sumber']}/{r['jenis']}] {(r['judul'] or r['teks'])[:100]}")
            print(f"      {r['url']}")
    if a.peristiwa:
        print("\nPeristiwa:")
        for p in crawler.gudang.peristiwa(a.misi_id):
            print(f"  {p['waktu']} {p['nama']:<28} {p['sumber']:<12} {json.dumps(p['detail'], ensure_ascii=False)}")


def cmd_ekspor(crawler: EcosystemCrawler, a) -> None:
    formats = list(FORMAT) if a.format == "semua" else _daftar(a.format)
    for p in ekspor(crawler.gudang, a.misi_id, formats, Path(a.ke) if a.ke else konfig.HASIL_DIR):
        print(p)


def cmd_katalog(crawler: EcosystemCrawler, a) -> None:
    status = crawler.report_status()
    if a.json:
        print(json.dumps(status, ensure_ascii=False, indent=2))
        return
    print(f"{status['name']} {status['version']} · gudang {(status['ukuran_gudang_byte'] or 0) / 1e6:.1f} MB "
          f"· proxy {status['proxy']}")
    print(f"robots.txt dipatuhi: {'ya' if status['patuhi_robots'] else 'tidak'} · "
          f"stealth: {'nyala' if status['stealth'] else 'mati'}\n")
    for s in status["katalog"]:
        aktif = "aktif" if s["aktif"] else "NONAKTIF"
        print(f"{s['id']:<12} kanal {s['kanal']:<6} {s['jenis_akses']:<15} {aktif:<9} {s['kesehatan']}")
        print(f"{'':<12} cocok untuk: {', '.join(s['cocok_untuk'])}")
        if s["alat"]:
            print(f"{'':<12} alat: {', '.join(t['nama'] + ' (' + t['repo'] + ')' for t in s['alat'])}")


def cmd_konfigurasi(crawler: EcosystemCrawler, a) -> None:
    data = crawler.configure(_daftar(a.nyalakan), _daftar(a.matikan))
    print(f"Sumber nonaktif: {', '.join(data['nonaktif']) or '(tidak ada)'}")


def parse_args(argv=None) -> argparse.Namespace:
    p = argparse.ArgumentParser(prog="crawler", description="Ecosystem Crawler: indra dan tangan Mamet.")
    p.add_argument("-v", "--verbose", action="store_true", help="Log detail")
    sub = p.add_subparsers(dest="perintah", required=True)

    c = sub.add_parser("cari", help="Jalankan misi langsung dari baris perintah")
    c.add_argument("kata_kunci", nargs="*", help="Satu atau lebih kata kunci (pakai tanda kutip untuk frasa)")
    c.add_argument("--url", action="append", default=[],
                   help="Link langsung untuk sumber kaskus/web/youtube (boleh diulang)")
    c.add_argument("--sumber", required=True, help="Pisahkan koma, mis. rss_media,arctic_shift,bluesky")
    c.add_argument("--sejak", default="", help="90h (hari), 12mg (minggu), 6b (bulan), atau YYYY-MM-DD")
    c.add_argument("--sampai", default="", help="YYYY-MM-DD (default: hari ini)")
    c.add_argument("--batas", type=int, default=100, help="Maks tangkapan per sumber (default 100)")
    c.add_argument("--total", type=int, default=1000, help="Maks tangkapan seluruh misi (default 1000)")
    c.add_argument("--komentar", action="store_true", help="Ambil juga komentar/balasan")
    c.add_argument("--kedalaman", type=int, default=1, help="Kedalaman utas komentar (default 1)")
    c.add_argument("--kecuali", default="", help="Buang item yang memuat kata ini, pisahkan koma")
    c.add_argument("--bahasa", default="id", help="Kode bahasa, mis. id atau en (default id)")
    c.add_argument("--wilayah", default="ID", help="Kode negara (default ID)")
    c.add_argument("--opsi", action="append", help="Opsi per sumber, mis. reddit.subreddit=indonesia")
    c.add_argument("--intent", default="", help="Catatan maksud perintah (disimpan sebagai jejak saja)")
    c.add_argument("--buka-identitas", action="store_true", help="Simpan username asli di ekspor (default pseudonim)")
    c.add_argument("--ekspor", default="", help="Langsung ekspor setelah selesai, mis. csv,md")

    m = sub.add_parser("misi", help="Jalankan berkas preset misi, atau lihat daftar misi")
    m.add_argument("aksi", choices=("jalankan", "daftar"))
    m.add_argument("berkas", nargs="?", help="Berkas .yaml atau .json")
    m.add_argument("--ekspor", default="", help="Langsung ekspor setelah selesai, mis. csv,md")
    m.add_argument("--batas", type=int, default=20, help="Jumlah misi di daftar")

    lihat = sub.add_parser("lihat", help="Ringkasan dan contoh hasil sebuah misi")
    lihat.add_argument("misi_id")
    lihat.add_argument("--contoh", type=int, default=10, help="Jumlah contoh tangkapan yang ditampilkan")
    lihat.add_argument("--peristiwa", action="store_true", help="Tampilkan log peristiwa adapter")

    e = sub.add_parser("ekspor", help="Ekspor hasil misi ke CSV/JSONL/MD")
    e.add_argument("misi_id")
    e.add_argument("--format", default="semua", help="csv,jsonl,md atau semua (default)")
    e.add_argument("--ke", default="", help="Folder tujuan (default: hasil/)")

    k = sub.add_parser("katalog", help="Daftar sumber, kanal, kesehatan, dan tool asli yang dibungkus")
    k.add_argument("--json", action="store_true", help="Keluaran lengkap ReportStatus() dalam JSON")

    kf = sub.add_parser("konfigurasi", help="Nyalakan atau matikan sumber")
    kf.add_argument("--nyalakan", default="", help="Pisahkan koma")
    kf.add_argument("--matikan", default="", help="Pisahkan koma")
    return p.parse_args(argv)


PERINTAH = {"cari": cmd_cari, "misi": cmd_misi, "lihat": cmd_lihat, "ekspor": cmd_ekspor,
            "katalog": cmd_katalog, "konfigurasi": cmd_konfigurasi}


def main(argv=None) -> None:
    # Konsol Windows/pipa bisa memakai cp1252; paksa UTF-8 agar ★ dan huruf non-ASCII tidak membuat crash.
    for s in (sys.stdout, sys.stderr):
        s.reconfigure(encoding="utf-8", errors="replace")
    a = parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if a.verbose else logging.INFO,
                        format="%(asctime)s [%(levelname)s] %(message)s", datefmt="%H:%M:%S")
    if not a.verbose:  # log pustaka pihak ketiga tidak perlu muncul
        for nama in ("urllib3", "prawcore"):
            logging.getLogger(nama).setLevel(logging.WARNING)
    try:
        with EcosystemCrawler() as crawler:
            PERINTAH[a.perintah](crawler, a)
    except (MisiTidakValid, KeyError, ValueError, FileNotFoundError) as exc:
        sys.exit(f"Gagal: {exc}")
