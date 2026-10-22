"""Kanal hp: folder inbox/ untuk salinan manual dari platform tertutup (Facebook Groups, Quora, X, TikTok, ...).
Dipindahkan dari `scraping masalah` (ADR-CRW-0004).

Format (nama file menentukan platform, mis. facebook_umkm.txt -> "Facebook Group"):
1) .txt  -- pisahkan tiap postingan dengan baris '---'. Baris opsional di awal postingan:
            URL: https://...   Tanggal: 2026-10-21   Judul: ...   Penulis: ...
2) .csv  -- kolom: teks (wajib), url, tanggal, judul, penulis, platform
File yang namanya diawali '_' (mis. _CARA_PAKAI.txt) diabaikan."""

import csv
import hashlib
import re
from collections.abc import Iterator
from pathlib import Path

from crawler import konfig
from crawler.inti import Misi, Pelapor, Sumber, Temuan
from crawler.inti.teks import ada_kata, bersihkan, ke_iso

PLATFORM_BY_PREFIX = {
    "facebook": "Facebook Group", "fb": "Facebook Group",
    "quora": "Quora",
    "x": "Twitter/X", "twitter": "Twitter/X",
    "threads": "Threads", "instagram": "Instagram", "tiktok": "TikTok",
    "kaskus": "Kaskus", "linkedin": "LinkedIn", "discord": "Discord", "telegram": "Telegram",
    "whatsapp": "WhatsApp Group", "wa": "WhatsApp Group",
}
_HEADER_RE = re.compile(r"^(url|tanggal|judul|penulis)\s*:\s*(.+)$", re.IGNORECASE)


def _platform_for(path: Path) -> str:
    prefix = re.split(r"[_\-\s]", path.stem.lower(), maxsplit=1)[0]
    return PLATFORM_BY_PREFIX.get(prefix, path.stem.split("_")[0].title())


def _make(platform: str, berkas: str, teks: str, url: str = "", tanggal: str = "", judul: str = "",
          penulis: str = "") -> Temuan | None:
    teks = bersihkan(teks)
    if not teks:
        return None
    digest = hashlib.sha1(teks.encode("utf-8")).hexdigest()[:16]
    return Temuan(
        jenis="postingan", id_asli=f"manual:{digest}", judul=judul, teks=teks,
        url=url or f"manual://{platform.lower().replace(' ', '-')}/{digest}", penulis=penulis,
        waktu_terbit=ke_iso(tanggal), metrik={"platform": platform, "berkas": berkas},
        mentah={"teks": teks, "url": url, "tanggal": tanggal, "judul": judul, "berkas": berkas},
    )


def _read_txt(path: Path) -> list[Temuan]:
    platform, out = _platform_for(path), []
    for block in re.split(r"^\s*-{3,}\s*$", path.read_text(encoding="utf-8-sig"), flags=re.MULTILINE):
        meta, body = {}, []
        for line in block.strip().splitlines():
            m = _HEADER_RE.match(line.strip()) if not body else None
            if m:
                meta[m.group(1).lower()] = m.group(2).strip()
            else:
                body.append(line)
        t = _make(platform, path.name, "\n".join(body), meta.get("url", ""), meta.get("tanggal", ""),
                  meta.get("judul", ""), meta.get("penulis", ""))
        if t:
            out.append(t)
    return out


def _read_csv(path: Path) -> list[Temuan]:
    default_platform, out = _platform_for(path), []
    with path.open(encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            row = {(k or "").strip().lower(): (v or "").strip() for k, v in row.items()}
            t = _make(row.get("platform") or default_platform, path.name, row.get("teks", ""), row.get("url", ""),
                      row.get("tanggal", ""), row.get("judul", ""), row.get("penulis", ""))
            if t:
                out.append(t)
    return out


class Inbox(Sumber):
    id = "inbox"
    kanal = "hp"
    jenis_akses = "manual"
    kemampuan = ("berkas_lokal",)
    bahasa = ("semua",)
    cocok_untuk = ("platform_tertutup", "facebook_group", "quora", "x", "tiktok", "kaskus")
    batas_laju = "tidak ada (berkas lokal)"
    alat = ()

    def __init__(self, folder: Path | None = None):
        self.folder = folder or konfig.INBOX_DIR

    def kesehatan(self) -> str:
        return "siap" if self.folder.is_dir() else f"folder {self.folder} belum ada"

    def ambil(self, misi: Misi, batas: int, lapor: Pelapor) -> Iterator[Temuan]:
        opsi = misi.opsi(self.id)
        folder = Path(opsi.get("folder") or self.folder)
        saring = bool(opsi.get("saring_kata_kunci", True)) and bool(misi.kata_kunci)
        for path in sorted(folder.glob(opsi.get("berkas", "*"))):
            if path.name.startswith("_") or path.suffix.lower() not in (".txt", ".csv"):
                continue
            items = _read_csv(path) if path.suffix.lower() == ".csv" else _read_txt(path)
            lapor("Sumber.BerkasDibaca", berkas=path.name, jumlah=len(items))
            for t in items:
                if not saring or ada_kata(f"{t.judul} {t.teks}", misi.kata_kunci):
                    yield t
