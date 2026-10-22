"""Kanal laptop: OpenAlex (api.openalex.org), katalog karya ilmiah terbuka (referensi akademik).

Gratis tanpa kunci; menyertakan email di parameter mailto untuk masuk "polite pool" (lebih stabil). Abstrak OpenAlex
berupa inverted index (kata -> posisi), jadi disusun ulang menjadi teks."""

from collections.abc import Iterator

from crawler import konfig
from crawler.inti import Misi, Pelapor, Sumber, Temuan
from crawler.inti.teks import bersihkan
from crawler.kanal import SesiSopan

API = "https://api.openalex.org/works"


def _abstrak(inv: dict | None) -> str:
    """Susun ulang abstract_inverted_index OpenAlex ({kata: [posisi, ...]}) menjadi teks."""
    if not inv:
        return ""
    kata_per_posisi = {pos: kata for kata, posisi in inv.items() for pos in posisi}
    return " ".join(kata_per_posisi[i] for i in sorted(kata_per_posisi))


class OpenAlex(Sumber):
    id = "openalex"
    kanal = "laptop"
    jenis_akses = "api_resmi"
    kemampuan = ("cari",)
    bahasa = ("semua",)
    cocok_untuk = ("ilmu_pengetahuan", "akademik", "jurnal", "riset")
    pseudonim_penulis = False  # penulis karya ilmiah = byline publik (ADR-CRW-0010)
    batas_laju = "jeda 1-2 detik; polite pool via mailto"
    alat = ({"nama": "OpenAlex API", "repo": "github.com/ourresearch/openalex-guts", "lisensi": "CC0 (data)"},)

    def ambil(self, misi: Misi, batas: int, lapor: Pelapor) -> Iterator[Temuan]:
        if not misi.kata_kunci:
            raise ValueError("openalex butuh kata_kunci")
        opsi = misi.opsi(self.id)
        sesi = SesiSopan(konfig.USER_AGENT, jeda=(1.0, 2.0))
        jatah = self.jatah_per_kata_kunci(misi, batas)
        filter_tahun = []
        if misi.dari:
            filter_tahun.append(f"from_publication_date:{misi.dari}")
        if misi.sampai:
            filter_tahun.append(f"to_publication_date:{misi.sampai}")
        if opsi.get("bahasa"):
            filter_tahun.append(f"language:{opsi['bahasa']}")

        for kw in misi.kata_kunci:
            params = {"search": kw, "per-page": min(jatah, 50),
                      "sort": "relevance_score:desc" if opsi.get("urut") != "terbaru" else "publication_date:desc"}
            if konfig.MAILTO:  # polite pool OpenAlex; dari .env, bukan di-hardcode
                params["mailto"] = konfig.MAILTO
            if filter_tahun:
                params["filter"] = ",".join(filter_tahun)
            data = sesi.get(API, params).json()
            hasil = data.get("results", [])
            lapor("Sumber.HasilKataKunci", kata_kunci=kw, jumlah=len(hasil), total=data.get("meta", {}).get("count"))
            for w in hasil:
                loc = w.get("primary_location") or {}
                src = loc.get("source") or {}
                penulis = [a["author"]["display_name"] for a in (w.get("authorships") or []) if a.get("author")]
                yield Temuan(
                    jenis="dokumen", id_asli=w.get("id", ""), judul=bersihkan(w.get("title")),
                    teks=_abstrak(w.get("abstract_inverted_index")) or bersihkan(w.get("title")),
                    url=loc.get("landing_page_url") or w.get("doi") or w.get("id", ""),
                    penulis="; ".join(penulis[:5]), waktu_terbit=w.get("publication_date") or "",
                    bahasa=w.get("language") or "",
                    metrik={"sitasi": w.get("cited_by_count"), "terbit_di": src.get("display_name"),
                            "doi": w.get("doi"), "tipe": w.get("type"), "jumlah_penulis": len(penulis)},
                    mentah={k: w.get(k) for k in ("id", "title", "publication_date", "doi", "language", "type",
                                                  "cited_by_count", "primary_location", "authorships",
                                                  "abstract_inverted_index")},
                )
