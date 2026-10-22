"""Kanal laptop: Stack Exchange (api.stackexchange.com), tanya-jawab teknis & rekomendasi software.

Tanpa kunci: kuota 300 permintaan/hari per IP. Mengambil pertanyaan (beserta isi body) dari satu atau beberapa situs
(default stackoverflow; untuk rekomendasi software pakai opsi site=softwarerecs). Penulis adalah handel pengguna,
jadi tetap dipseudonimkan. Jawaban/komentar belum diambil (hemat kuota)."""

from collections.abc import Iterator
from datetime import datetime, timezone

from crawler import konfig
from crawler.inti import Misi, Pelapor, Sumber, Temuan
from crawler.inti.teks import bersihkan, ke_iso, sebagai_daftar
from crawler.kanal import SesiSopan

API = "https://api.stackexchange.com/2.3/search/advanced"


class StackExchange(Sumber):
    id = "stackexchange"
    kanal = "laptop"
    jenis_akses = "api_resmi"
    kemampuan = ("cari",)
    bahasa = ("en",)
    cocok_untuk = ("tanya_jawab_teknis", "rekomendasi_software", "solusi_masalah")
    batas_laju = "kuota 300/hari per IP tanpa kunci; jeda 1-2 detik"
    alat = ({"nama": "Stack Exchange API 2.3", "repo": "api.stackexchange.com", "lisensi": "API resmi (data CC BY-SA)"},)

    def ambil(self, misi: Misi, batas: int, lapor: Pelapor) -> Iterator[Temuan]:
        if not misi.kata_kunci:
            raise ValueError("stackexchange butuh kata_kunci")
        opsi = misi.opsi(self.id)
        situs = sebagai_daftar(opsi.get("site")) or ["stackoverflow"]
        sesi = SesiSopan(konfig.USER_AGENT, jeda=(1.0, 2.0))
        jatah = self.jatah_per_kata_kunci(misi, batas)
        urut = "creation" if opsi.get("urut") == "terbaru" else "relevance"

        for site in situs:
            for kw in misi.kata_kunci:
                params = {"q": kw, "site": site, "order": "desc", "sort": urut, "filter": "withbody",
                          "pagesize": min(jatah, 50)}
                if misi.dari:
                    params["fromdate"] = int(datetime.fromisoformat(misi.dari).replace(tzinfo=timezone.utc).timestamp())
                if misi.sampai:
                    params["todate"] = int(datetime.fromisoformat(misi.sampai).replace(tzinfo=timezone.utc).timestamp())
                data = sesi.get(API, params).json()
                items = data.get("items", [])
                lapor("Sumber.HasilKataKunci", kata_kunci=kw, site=site, jumlah=len(items),
                      sisa_kuota=data.get("quota_remaining"))
                for q in items:
                    owner = q.get("owner") or {}
                    yield Temuan(
                        jenis="postingan", id_asli=f"{site}:{q['question_id']}", judul=bersihkan(q.get("title")),
                        teks=bersihkan(q.get("body")) or bersihkan(q.get("title")), url=q.get("link", ""),
                        penulis=owner.get("display_name", ""),
                        waktu_terbit=ke_iso(datetime.fromtimestamp(q["creation_date"], timezone.utc))
                        if q.get("creation_date") else "",
                        bahasa="en",
                        metrik={"skor": q.get("score"), "jawaban": q.get("answer_count"),
                                "dilihat": q.get("view_count"), "terjawab": q.get("is_answered"),
                                "tags": q.get("tags"), "site": site},
                        mentah=q,
                    )
                if data.get("quota_remaining", 1) <= 0:
                    lapor("Sumber.KuotaHabis", site=site)
                    return
