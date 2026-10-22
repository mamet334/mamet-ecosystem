"""Kanal tv: TurnBackHoax.ID (Mafindo), bantahan hoaks & penipuan (referensi cek fakta).

Feed WordPress (/feed), sama pola dengan Media Konsumen. Judul berlabel [SALAH]/[PENIPUAN]/[BENAR]/... yang
disimpan sebagai metrik `label`. Bila tag/kategori tidak diberikan, membaca feed utama lalu menyaring dengan kata
kunci. Isi lengkap bantahan diambil dari halamannya.

Catatan Mamet: isi di sini pun masuk sebagai hypothesis. TurnBackHoax terverifikasi IFCN, jadi confidence
pengambilannya wajar, tetapi vonis benar/salah tetap urusan Knowledge System."""

import re
from collections.abc import Iterator

import feedparser

from crawler import konfig
from crawler.inti import Misi, Pelapor, Sumber, Temuan
from crawler.inti.teks import ada_kata, bersihkan, ke_iso, sebagai_daftar
from crawler.kanal import AksesWeb, DilarangRobots, Terblokir

from .web import ekstrak

DASAR = "https://turnbackhoax.id"
_LABEL = re.compile(r"^\[([^\]]+)\]")  # mis. [SALAH], [PENIPUAN]


class TurnBackHoax(Sumber):
    id = "turnbackhoax"
    kanal = "tv"
    jenis_akses = "feed"
    kemampuan = ("feed", "tag")
    bahasa = ("id",)
    cocok_untuk = ("cek_fakta", "hoaks", "penipuan", "disinformasi")
    pseudonim_penulis = False  # penulis/pemeriksa fakta = byline publik (ADR-CRW-0010)
    batas_laju = "jeda 1-2 detik per feed/halaman; isi lengkap diekstrak"
    alat = (
        {"nama": "feedparser", "repo": "github.com/kurtmckee/feedparser", "lisensi": "BSD-2-Clause"},
        {"nama": "trafilatura", "repo": "github.com/adbar/trafilatura", "lisensi": "Apache-2.0"},
    )

    def ambil(self, misi: Misi, batas: int, lapor: Pelapor) -> Iterator[Temuan]:
        opsi = misi.opsi(self.id)
        jalur = ([f"tag/{t}" for t in sebagai_daftar(opsi.get("tag"))]
                 + [f"category/{k}" for k in sebagai_daftar(opsi.get("kategori"))]) or [""]
        halaman = int(opsi.get("halaman", 3))
        ambil_isi = bool(opsi.get("ambil_isi", True))
        saring = bool(misi.kata_kunci)
        akses = AksesWeb(konfig.USER_AGENT)
        diambil = 0

        for j in dict.fromkeys(jalur):
            for hal in range(1, halaman + 1):
                url = f"{DASAR}/{j}/feed".replace("//feed", "/feed") + (f"?paged={hal}" if hal > 1 else "")
                try:
                    teks_feed, _, _ = akses.ambil(url, lapor)
                except (DilarangRobots, Terblokir) as exc:
                    lapor("Sumber.HalamanDilewati", url=url, alasan=str(exc))
                    break
                except Exception as exc:  # tag tidak ada / halaman habis
                    lapor("Sumber.FeedTidakAda", jalur=j or "feed_utama", halaman=hal, alasan=str(exc)[:120])
                    break
                entries = feedparser.parse(teks_feed).entries
                lapor("Sumber.HasilFeed", jalur=j or "feed_utama", halaman=hal, jumlah=len(entries))
                if not entries:
                    break
                for e in entries:
                    if saring and not ada_kata(f"{e.get('title', '')} {e.get('summary', '')}", misi.kata_kunci):
                        continue
                    judul = bersihkan(e.get("title"))
                    m = _LABEL.match(judul)
                    t = Temuan(
                        jenis="dokumen", id_asli=e.get("id") or e.get("link", ""), judul=judul,
                        teks=bersihkan(e.get("summary")) or judul, url=e.get("link", ""),
                        penulis=e.get("author", ""), waktu_terbit=ke_iso(e.get("published_parsed")), bahasa="id",
                        metrik={"label": m.group(1).upper() if m else "", "jalur": j or "feed_utama"},
                        mentah=dict(e),
                    )
                    if ambil_isi:
                        self._isi(t, akses, lapor)
                    yield t
                    diambil += 1
                    if diambil >= batas:
                        return

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
