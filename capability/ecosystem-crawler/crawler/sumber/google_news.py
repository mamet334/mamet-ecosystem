"""Kanal tv: Google News RSS lewat feedparser. Satu permintaan per kata kunci.

Diaktifkan lagi di ADR-CRW-0010 (robots.txt jadi sakelar Owner). Google News RSS hanya memuat judul berita; untuk isi
lengkap, perencana memakai sumber `web` dengan link aslinya."""

from collections.abc import Iterator

import feedparser

from crawler import konfig
from crawler.inti import Misi, Pelapor, Sumber, Temuan
from crawler.inti.teks import bersihkan, ke_iso
from crawler.kanal import SesiSopan

URL = "https://news.google.com/rss/search"


class GoogleNews(Sumber):
    id = "google_news"
    kanal = "tv"
    jenis_akses = "feed"
    kemampuan = ("cari", "feed")
    bahasa = ("id", "en", "semua")
    cocok_untuk = ("berita", "isu_publik", "tren")
    pseudonim_penulis = False  # nama media (byline publik), bukan individu
    batas_laju = "jeda 1-2 detik per permintaan; maks ±100 artikel per kata kunci"
    alat = (
        {"nama": "feedparser", "repo": "github.com/kurtmckee/feedparser", "lisensi": "BSD-2-Clause"},
        {"nama": "requests", "repo": "github.com/psf/requests", "lisensi": "Apache-2.0"},
    )

    def ambil(self, misi: Misi, batas: int, lapor: Pelapor) -> Iterator[Temuan]:
        if not misi.kata_kunci:
            raise ValueError("google_news butuh kata_kunci")
        hl = misi.bahasa[0] if misi.bahasa else "id"
        gl = (misi.wilayah or "ID").upper()
        sesi = SesiSopan(konfig.USER_AGENT, jeda=(1.0, 2.0))
        jatah = self.jatah_per_kata_kunci(misi, batas)

        for kw in misi.kata_kunci:
            q = f'"{kw}"' if " " in kw else kw
            if misi.dari:
                q += f" after:{misi.dari}"
            if misi.sampai:
                q += f" before:{misi.sampai}"
            feed = feedparser.parse(sesi.get(URL, {"q": q, "hl": hl, "gl": gl, "ceid": f"{gl}:{hl}"}).content)
            lapor("Sumber.HasilKataKunci", kata_kunci=kw, jumlah=len(feed.entries))
            for e in feed.entries[:jatah]:
                media = e.get("source") or {}
                judul = bersihkan(e.get("title"))
                # Judul Google News berakhiran " - Nama Media"; nama media disimpan terpisah.
                if media.get("title") and judul.endswith(f" - {media['title']}"):
                    judul = judul[: -len(media["title"]) - 3]
                yield Temuan(
                    jenis="artikel",
                    id_asli=e.get("id", ""),
                    judul=judul,
                    teks=judul,  # RSS hanya memuat judul; isi lengkap lewat sumber `web`
                    url=e.get("link", ""),
                    waktu_terbit=ke_iso(e.get("published_parsed")),
                    bahasa=hl,
                    metrik={"media": media.get("title", ""), "situs_media": media.get("href", "")},
                    mentah=dict(e),
                )
