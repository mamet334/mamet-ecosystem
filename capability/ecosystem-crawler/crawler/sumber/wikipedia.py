"""Kanal laptop: Wikipedia (MediaWiki API), ensiklopedi rujukan bersitasi.

Pencarian lewat action API (list=search), lalu ringkasan tiap halaman lewat REST summary. Bahasa dari opsi `bahasa`
atau bahasa misi (default id). Ringkasan = paragraf pembuka; opsi `isi_penuh` mengambil seluruh teks halaman."""

from collections.abc import Iterator
from urllib.parse import quote

from crawler import konfig
from crawler.inti import Misi, Pelapor, Sumber, Temuan
from crawler.inti.teks import bersihkan, ke_iso
from crawler.kanal import SesiSopan


class Wikipedia(Sumber):
    id = "wikipedia"
    kanal = "laptop"
    jenis_akses = "api_resmi"
    kemampuan = ("cari",)
    bahasa = ("id", "en", "semua")
    cocok_untuk = ("ensiklopedi", "rujukan", "latar_topik", "definisi")
    batas_laju = "jeda 1 detik; API MediaWiki publik"
    alat = ({"nama": "MediaWiki API", "repo": "github.com/wikimedia/mediawiki", "lisensi": "GPL-2.0 (perangkat)"},)

    def ambil(self, misi: Misi, batas: int, lapor: Pelapor) -> Iterator[Temuan]:
        if not misi.kata_kunci:
            raise ValueError("wikipedia butuh kata_kunci")
        opsi = misi.opsi(self.id)
        lang = opsi.get("bahasa", misi.bahasa[0] if misi.bahasa and misi.bahasa[0] != "semua" else "id")
        isi_penuh = bool(opsi.get("isi_penuh"))
        sesi = SesiSopan(konfig.USER_AGENT, jeda=(1.0, 1.5))
        api = f"https://{lang}.wikipedia.org/w/api.php"
        rest = f"https://{lang}.wikipedia.org/api/rest_v1/page/summary/"
        jatah = self.jatah_per_kata_kunci(misi, batas)

        for kw in misi.kata_kunci:
            cari = sesi.get(api, {"action": "query", "list": "search", "srsearch": kw, "format": "json",
                                  "srlimit": min(jatah, 20)}).json()
            judul_list = [h["title"] for h in cari.get("query", {}).get("search", [])]
            lapor("Sumber.HasilKataKunci", kata_kunci=kw, jumlah=len(judul_list))
            for judul in judul_list:
                sm = sesi.get(rest + quote(judul.replace(" ", "_"), safe="")).json()
                if sm.get("type") == "disambiguation":
                    continue
                teks = bersihkan(sm.get("extract"))
                url = (sm.get("content_urls") or {}).get("desktop", {}).get("page") or \
                    f"https://{lang}.wikipedia.org/wiki/{quote(judul.replace(' ', '_'))}"
                if isi_penuh:
                    teks = self._isi_penuh(sesi, api, judul) or teks
                yield Temuan(
                    jenis="dokumen", id_asli=f"wiki:{lang}:{sm.get('pageid', judul)}", judul=bersihkan(sm.get("title")),
                    teks=teks or judul, url=url, waktu_terbit=ke_iso(sm.get("timestamp")), bahasa=lang,
                    metrik={"deskripsi": sm.get("description"), "wikibase": sm.get("wikibase_item")},
                    mentah=sm,
                )

    @staticmethod
    def _isi_penuh(sesi: SesiSopan, api: str, judul: str) -> str:
        data = sesi.get(api, {"action": "query", "prop": "extracts", "explaintext": 1, "titles": judul,
                              "format": "json", "redirects": 1}).json()
        pages = data.get("query", {}).get("pages", {})
        return bersihkan(next(iter(pages.values()), {}).get("extract", "")) if pages else ""
