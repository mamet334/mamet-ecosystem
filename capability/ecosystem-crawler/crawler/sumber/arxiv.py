"""Kanal laptop: arXiv (export.arxiv.org/api), preprint sains terbuka (fisika, matematika, CS).

API Atom, diurai feedparser. Penulis = byline publik (tanpa pseudonim). Rentang tanggal disaring oleh Dispatcher
dari waktu_terbit; opsi `urut=terbaru` mengurutkan dari yang terbaru."""

from collections.abc import Iterator

import feedparser

from crawler import konfig
from crawler.inti import Misi, Pelapor, Sumber, Temuan
from crawler.inti.teks import bersihkan, ke_iso
from crawler.kanal import SesiSopan

API = "http://export.arxiv.org/api/query"


class Arxiv(Sumber):
    id = "arxiv"
    kanal = "laptop"
    jenis_akses = "api_resmi"
    kemampuan = ("cari",)
    bahasa = ("en",)
    cocok_untuk = ("sains", "fisika", "matematika", "ilmu_komputer", "preprint")
    pseudonim_penulis = False  # penulis preprint = byline publik (ADR-CRW-0010)
    batas_laju = "jeda 3 detik (arXiv minta ≥3 detik antar-permintaan)"
    alat = (
        {"nama": "arXiv API", "repo": "info.arxiv.org/help/api", "lisensi": "API resmi arXiv"},
        {"nama": "feedparser", "repo": "github.com/kurtmckee/feedparser", "lisensi": "BSD-2-Clause"},
    )

    def ambil(self, misi: Misi, batas: int, lapor: Pelapor) -> Iterator[Temuan]:
        if not misi.kata_kunci:
            raise ValueError("arxiv butuh kata_kunci")
        opsi = misi.opsi(self.id)
        bidang = opsi.get("bidang", "all")  # mis. 'cat:quant-ph', atau 'all', 'ti' (judul), 'abs' (abstrak)
        sesi = SesiSopan(konfig.USER_AGENT, jeda=(3.0, 3.5))  # arXiv minta minimal 3 detik
        jatah = self.jatah_per_kata_kunci(misi, batas)
        urut = "submittedDate" if opsi.get("urut") == "terbaru" else "relevance"

        for kw in misi.kata_kunci:
            params = {"search_query": f"{bidang}:{kw}" if ":" not in bidang else f"{bidang} AND all:{kw}",
                      "start": 0, "max_results": min(jatah, 50), "sortBy": urut, "sortOrder": "descending"}
            feed = feedparser.parse(sesi.get(API, params).content)
            lapor("Sumber.HasilKataKunci", kata_kunci=kw, jumlah=len(feed.entries))
            for e in feed.entries:
                penulis = [a.get("name", "") for a in e.get("authors", [])]
                pdf = next((l.get("href") for l in e.get("links", []) if l.get("type") == "application/pdf"), "")
                yield Temuan(
                    jenis="dokumen", id_asli=e.get("id", ""), judul=bersihkan(e.get("title")),
                    teks=bersihkan(e.get("summary")) or bersihkan(e.get("title")), url=e.get("id", ""),
                    penulis="; ".join(p for p in penulis[:8] if p), waktu_terbit=ke_iso(e.get("published")),
                    bahasa="en",
                    metrik={"kategori": [t.get("term") for t in e.get("tags", [])],
                            "kategori_utama": (e.get("arxiv_primary_category") or {}).get("term"), "pdf": pdf,
                            "jumlah_penulis": len(penulis)},
                    mentah=dict(e),
                )
