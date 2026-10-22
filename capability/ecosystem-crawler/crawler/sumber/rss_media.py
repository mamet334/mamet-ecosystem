"""Kanal tv: RSS resmi media Indonesia (ADR-CRW-0009), pengganti Google News RSS.

RSS media hanya memuat berita terbaru (50-100 per feed), lalu disaring dengan kata kunci misi. Isi lengkap artikel
bisa diambil dengan opsi ambil_isi (halaman dicek robots.txt, diekstrak trafilatura). Untuk mencari berita lama atau
spesifik, perencana mencari link-nya lalu memakai sumber `web`."""

from collections.abc import Iterator

import feedparser

from crawler import konfig
from crawler.inti import Misi, Pelapor, Sumber, Temuan
from crawler.inti.teks import ada_kata, bersihkan, ke_iso, sebagai_daftar
from crawler.kanal import AksesWeb, DilarangRobots, Terblokir

from .web import ekstrak

FEED = {
    "detik": "https://news.detik.com/berita/rss",
    "detik_finance": "https://finance.detik.com/rss",
    "cnnindonesia": "https://www.cnnindonesia.com/nasional/rss",
    "cnnindonesia_ekonomi": "https://www.cnnindonesia.com/ekonomi/rss",
    "antara": "https://www.antaranews.com/rss/terkini.xml",
}


class RssMedia(Sumber):
    id = "rss_media"
    kanal = "tv"
    jenis_akses = "feed"
    kemampuan = ("feed", "saring_kata_kunci")
    bahasa = ("id",)
    cocok_untuk = ("berita_terbaru", "isu_publik", "tren")
    pseudonim_penulis = False  # penulis berita = byline publik (ADR-CRW-0010)
    batas_laju = "jeda 1-2 detik per feed/halaman; robots.txt mengikuti sakelar (lihat akses di katalog)"
    alat = (
        {"nama": "feedparser", "repo": "github.com/kurtmckee/feedparser", "lisensi": "BSD-2-Clause"},
        {"nama": "trafilatura", "repo": "github.com/adbar/trafilatura", "lisensi": "Apache-2.0"},
    )

    def ambil(self, misi: Misi, batas: int, lapor: Pelapor) -> Iterator[Temuan]:
        opsi = misi.opsi(self.id)
        media = sebagai_daftar(opsi.get("media")) or list(FEED)
        feeds = {m: FEED[m] for m in media if m in FEED}
        feeds.update({u: u for u in sebagai_daftar(opsi.get("feed"))})
        tidak_dikenal = [m for m in media if m not in FEED]
        if tidak_dikenal:
            lapor("Sumber.MediaTidakDikenal", media=tidak_dikenal, pilihan=list(FEED))
        ambil_isi, maks_isi, diisi = bool(opsi.get("ambil_isi")), int(opsi.get("maks_isi", 20)), 0
        akses = AksesWeb(konfig.USER_AGENT)

        for nama, url in feeds.items():
            try:
                teks_feed, _, _ = akses.ambil(url, lapor)
            except (DilarangRobots, Terblokir) as exc:
                lapor("Sumber.HalamanDilewati", url=url, alasan=str(exc))
                continue
            feed = feedparser.parse(teks_feed)
            cocok = [e for e in feed.entries
                     if not misi.kata_kunci or ada_kata(f"{e.get('title', '')} {e.get('summary', '')}", misi.kata_kunci)]
            lapor("Sumber.HasilFeed", media=nama, isi_feed=len(feed.entries), cocok=len(cocok))
            for e in cocok:
                t = Temuan(
                    jenis="artikel", id_asli=e.get("id") or e.get("link", ""), judul=bersihkan(e.get("title")),
                    teks=bersihkan(e.get("summary")) or bersihkan(e.get("title")), url=e.get("link", ""),
                    waktu_terbit=ke_iso(e.get("published_parsed") or e.get("published")), bahasa="id",
                    metrik={"media": nama}, mentah=dict(e),
                )
                if ambil_isi and diisi < maks_isi:
                    diisi += 1
                    self._isi(t, akses, lapor)
                yield t

    @staticmethod
    def _isi(t: Temuan, akses: AksesWeb, lapor: Pelapor) -> None:
        try:
            html, tingkat, url = akses.ambil(t.url, lapor)
        except (DilarangRobots, Terblokir) as exc:
            t.metrik["isi"] = f"tidak diambil: {exc}"
            return
        teks = (ekstrak(html, url).get("text") or "").strip()
        if teks:
            t.teks, t.jenis_akses = teks, "html"
            t.metrik["tingkat_akses"] = tingkat
            t.mentah = {"rss": t.mentah, "html": html}
