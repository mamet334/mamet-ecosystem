"""Kanal laptop: Media Konsumen (mediakonsumen.com), surat pembaca keluhan konsumen Indonesia (ADR-CRW-0009).

Pencarian situs (/?s=) dilarang robots.txt, jadi yang dipakai adalah feed WordPress per tag atau kategori, yang
diizinkan. Tag dari opsi `tag` (slug, mis. "bpjs-kesehatan"); bila kosong, dibentuk dari kata kunci misi.
Bila tidak ada satu pun tag/kategori yang menghasilkan surat, crawler membaca beberapa halaman feed utama (surat
terbaru) dan menyaringnya dengan kata kunci. Isi lengkap surat diambil dari halamannya (default aktif) karena feed
hanya memuat paragraf pertama."""

import re
from collections.abc import Iterator

import feedparser

from crawler import konfig
from crawler.inti import Misi, Pelapor, Sumber, Temuan
from crawler.inti.teks import ada_kata, bersihkan, ke_iso, sebagai_daftar
from crawler.kanal import AksesWeb, DilarangRobots, Terblokir

from .web import ekstrak

DASAR = "https://mediakonsumen.com"
# Feed menambahkan baris promosi situs di akhir ringkasan.
_PROMOSI = re.compile(r"\s*(Baca juga|Media Konsumen).*$", re.DOTALL)


def slug(teks: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", teks.lower()).strip("-")


class MediaKonsumen(Sumber):
    id = "mediakonsumen"
    kanal = "laptop"
    jenis_akses = "feed"
    kemampuan = ("feed", "tag")
    bahasa = ("id",)
    cocok_untuk = ("keluhan", "keluhan_konsumen", "layanan_publik", "produk_dan_jasa")
    batas_laju = "jeda 1-2 detik per feed/halaman; robots.txt mengikuti sakelar (lihat akses di katalog)"
    alat = (
        {"nama": "feedparser", "repo": "github.com/kurtmckee/feedparser", "lisensi": "BSD-2-Clause"},
        {"nama": "trafilatura", "repo": "github.com/adbar/trafilatura", "lisensi": "Apache-2.0"},
    )

    def ambil(self, misi: Misi, batas: int, lapor: Pelapor) -> Iterator[Temuan]:
        opsi = misi.opsi(self.id)
        jalur = ([f"tag/{t}" for t in sebagai_daftar(opsi.get("tag"))]
                 + [f"category/{k}" for k in sebagai_daftar(opsi.get("kategori"))])
        if not jalur:
            if not misi.kata_kunci:
                raise ValueError("mediakonsumen butuh opsi tag/kategori atau kata_kunci")
            jalur = [f"tag/{slug(k)}" for k in misi.kata_kunci]
        halaman = int(opsi.get("halaman", 3))
        ambil_isi = bool(opsi.get("ambil_isi", True))
        akses = AksesWeb(konfig.USER_AGENT)
        diambil = 0

        for j in dict.fromkeys(jalur):
            for e in self._baca_feed(akses, j, halaman, lapor):
                yield self._temuan(e, j, akses, ambil_isi, lapor)
                diambil += 1
                if diambil >= batas:
                    return

        if diambil or not misi.kata_kunci:
            return
        # Cadangan: tag tidak ada atau kosong. Baca surat terbaru di feed utama, saring dengan kata kunci
        # (judul + paragraf pertama) sebelum mengambil isi lengkap, agar tidak membuka halaman yang tidak relevan.
        halaman_utama = int(opsi.get("halaman_cadangan", 5))
        lapor("Adapter.FallbackTriggered", dari="tag", ke="feed_utama", halaman=halaman_utama)
        for e in self._baca_feed(akses, "", halaman_utama, lapor):
            if not ada_kata(f"{e.get('title', '')} {e.get('summary', '')}", misi.kata_kunci):
                continue
            yield self._temuan(e, "feed_utama", akses, ambil_isi, lapor)
            diambil += 1
            if diambil >= batas:
                return

    @staticmethod
    def _baca_feed(akses: AksesWeb, jalur: str, halaman: int, lapor: Pelapor) -> Iterator[dict]:
        dasar = f"{DASAR}/{jalur}/feed" if jalur else f"{DASAR}/feed"
        for hal in range(1, halaman + 1):
            url = dasar + (f"?paged={hal}" if hal > 1 else "")
            try:
                teks_feed, _, _ = akses.ambil(url, lapor)
            except (DilarangRobots, Terblokir) as exc:
                lapor("Sumber.HalamanDilewati", url=url, alasan=str(exc))
                return
            except Exception as exc:  # tag tidak ada / halaman habis (404)
                lapor("Sumber.FeedTidakAda", jalur=jalur or "feed_utama", halaman=hal, alasan=str(exc)[:120])
                return
            entries = feedparser.parse(teks_feed).entries
            lapor("Sumber.HasilFeed", jalur=jalur or "feed_utama", halaman=hal, jumlah=len(entries))
            if not entries:
                return
            yield from entries

    def _temuan(self, e: dict, jalur: str, akses: AksesWeb, ambil_isi: bool, lapor: Pelapor) -> Temuan:
        t = Temuan(
            jenis="postingan", id_asli=e.get("id") or e.get("link", ""), judul=bersihkan(e.get("title")),
            teks=_PROMOSI.sub("", bersihkan(e.get("summary"))), url=e.get("link", ""),
            penulis=e.get("author", ""), waktu_terbit=ke_iso(e.get("published_parsed")), bahasa="id",
            metrik={"komentar": int(e.get("slash_comments") or 0), "jalur": jalur,
                    "label": [x.get("term") for x in e.get("tags") or []]},
            mentah=dict(e),
        )
        if ambil_isi:
            self._isi(t, akses, lapor)
        return t

    @staticmethod
    def _isi(t: Temuan, akses: AksesWeb, lapor: Pelapor) -> None:
        try:
            html, _, url = akses.ambil(t.url, lapor)
        except (DilarangRobots, Terblokir) as exc:
            t.metrik["isi"] = f"tidak diambil: {exc}"
            return
        teks = (ekstrak(html, url).get("text") or "").strip()
        if teks:
            t.teks, t.jenis_akses = teks, "html"
            t.mentah = {"rss": t.mentah, "html": html}
