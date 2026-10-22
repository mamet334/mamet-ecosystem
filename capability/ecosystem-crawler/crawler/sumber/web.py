"""Kanal laptop: halaman web publik apa pun dari url_awal, isinya diekstrak dengan trafilatura.

Untuk halaman yang ditemukan perencana (mis. lewat mesin pencari Claude): artikel, blog, halaman forum, rilis.
Link milik sumber khusus yang ikut dalam misi yang sama (Kaskus, YouTube) diserahkan ke sumber itu."""

from collections.abc import Iterator

import trafilatura

from crawler import konfig
from crawler.inti import Misi, Pelapor, Sumber, Temuan
from crawler.inti.teks import bersihkan, ke_iso
from crawler.kanal import AksesWeb, DilarangRobots, Terblokir

from .kaskus import url_kaskus


def ekstrak(html: str, url: str) -> dict:
    """Judul, teks, tanggal, penulis, dan nama situs dari halaman (trafilatura)."""
    doc = trafilatura.bare_extraction(html, url=url, with_metadata=True, include_comments=False)
    return doc.as_dict() if doc is not None else {}


class Web(Sumber):
    id = "web"
    kanal = "laptop"
    jenis_akses = "html"
    kemampuan = ("url_langsung",)
    bahasa = ("semua",)
    cocok_untuk = ("artikel", "blog", "halaman_resmi", "hasil_mesin_pencari")
    batas_laju = "jeda 1-2 detik per halaman; robots.txt mengikuti sakelar (lihat akses di katalog)"
    alat = (
        {"nama": "trafilatura", "repo": "github.com/adbar/trafilatura", "lisensi": "Apache-2.0"},
        {"nama": "curl_cffi", "repo": "github.com/lexiforest/curl_cffi", "lisensi": "MIT"},
    )

    def ambil(self, misi: Misi, batas: int, lapor: Pelapor) -> Iterator[Temuan]:
        urls = [u for u in misi.url_awal
                if not ("kaskus" in misi.sumber and url_kaskus(u))
                and not ("youtube" in misi.sumber and "youtu" in u)]
        if not urls:
            raise ValueError("web butuh url_awal berisi link halaman")
        akses = AksesWeb(konfig.USER_AGENT)
        for url in list(dict.fromkeys(urls))[:batas]:
            try:
                html, tingkat, url_akhir = akses.ambil(url, lapor)
            except (DilarangRobots, Terblokir) as exc:
                lapor("Sumber.HalamanDilewati", url=url, alasan=str(exc))
                continue
            d = ekstrak(html, url_akhir)
            teks = (d.get("text") or "").strip()
            if not teks:
                lapor("Sumber.HalamanDilewati", url=url, alasan="isi utama tidak terbaca")
                continue
            yield Temuan(
                jenis="dokumen", judul=bersihkan(d.get("title")), teks=teks, url=url_akhir,
                penulis=d.get("author") or "", waktu_terbit=ke_iso(d.get("date")), bahasa=d.get("language") or "",
                metrik={"situs": d.get("sitename") or "", "tingkat_akses": tingkat}, mentah=html,
            )
