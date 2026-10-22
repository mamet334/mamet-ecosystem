"""Kanal hp: Bluesky lewat AppView API publik tanpa login (searchPosts + getPostThread).
Dokumentasi: https://docs.bsky.app/docs/api/app-bsky-feed-search-posts"""

from collections.abc import Iterator
from fnmatch import fnmatch

import requests

from crawler import konfig
from crawler.inti import Misi, Pelapor, Sumber, Temuan
from crawler.inti.teks import bersihkan, ke_iso, sebagai_daftar
from crawler.kanal import SesiSopan

API = "https://api.bsky.app/xrpc"


def _url(post: dict) -> str:
    handle = post.get("author", {}).get("handle", "")
    return f"https://bsky.app/profile/{handle}/post/{post.get('uri', '').rsplit('/', 1)[-1]}"


def _temuan(post: dict, jenis: str, induk: dict | None = None) -> Temuan:
    rec = post.get("record", {})
    return Temuan(
        jenis=jenis,
        id_asli=post.get("uri", ""),
        teks=bersihkan(rec.get("text")),
        url=_url(post),
        url_induk=_url(induk) if induk else "",
        id_asli_induk=(rec.get("reply") or {}).get("parent", {}).get("uri", "") if induk else "",
        penulis=post.get("author", {}).get("handle", ""),
        waktu_terbit=ke_iso(rec.get("createdAt")),
        bahasa=(rec.get("langs") or [""])[0],
        metrik={k: post.get(f"{k}Count", 0) for k in ("like", "reply", "repost", "quote")},
        mentah=post,
    )


class Bluesky(Sumber):
    id = "bluesky"
    kanal = "hp"
    jenis_akses = "api_resmi"
    kemampuan = ("cari", "komentar")
    bahasa = ("semua",)
    cocok_untuk = ("opini_spontan", "keluhan", "isu_publik")
    batas_laju = "jeda 0,5-1 detik; 100 postingan per halaman"
    # Akun robot media (mis. kumparan-poster, katadata-poster) hanya mengulang judul berita, bukan suara warga.
    kecualikan_penulis_default = ("*-poster.bsky.social",)
    alat = (
        {"nama": "Bluesky AppView API", "repo": "github.com/bluesky-social/atproto", "lisensi": "MIT/Apache-2.0"},
        {"nama": "requests", "repo": "github.com/psf/requests", "lisensi": "Apache-2.0"},
    )

    def ambil(self, misi: Misi, batas: int, lapor: Pelapor) -> Iterator[Temuan]:
        if not misi.kata_kunci:
            raise ValueError("bluesky butuh kata_kunci")
        sesi = SesiSopan(konfig.USER_AGENT, jeda=(0.5, 1.0))
        opsi = misi.opsi(self.id)
        lang = opsi.get("lang", misi.bahasa[0] if misi.bahasa else "")
        jatah = self.jatah_per_kata_kunci(misi, batas)
        # Akun yang dikecualikan dilewati sebelum dihitung ke jatah; kalau tidak, halaman pertama yang penuh akun
        # robot berita menghabiskan jatah dan hasil akhirnya kosong (Dispatcher tetap menyaring ulang).
        kecualikan = sebagai_daftar(opsi.get("kecualikan_penulis", list(self.kecualikan_penulis_default)))

        def dikecualikan(post: dict) -> bool:
            handle = post.get("author", {}).get("handle", "").lower()
            return any(fnmatch(handle, p.lower()) for p in kecualikan)

        for kw in misi.kata_kunci:
            diambil = 0
            params = {"q": f'"{kw}"' if " " in kw else kw, "sort": opsi.get("urut", "latest"), "limit": 100}
            if lang and lang != "semua":
                params["lang"] = lang
            if misi.dari:
                params["since"] = f"{misi.dari}T00:00:00Z"
            if misi.sampai:
                params["until"] = f"{misi.sampai}T23:59:59Z"
            while diambil < jatah:
                try:
                    data = sesi.get(f"{API}/app.bsky.feed.searchPosts", params).json()
                except requests.HTTPError as exc:
                    # Tanpa login, Bluesky menolak (403) halaman lanjutan pencarian; berhenti di halaman pertama.
                    if "cursor" not in params or exc.response.status_code != 403:
                        raise
                    lapor("Sumber.HalamanLanjutanDitolak", kata_kunci=kw, alasan="403 tanpa login")
                    break
                semua = data.get("posts", [])
                posts = [p for p in semua if not dikecualikan(p)]
                lapor("Sumber.HasilKataKunci", kata_kunci=kw, jumlah=len(semua), dikecualikan=len(semua) - len(posts))
                for p in posts[: jatah - diambil]:
                    yield _temuan(p, "postingan")
                    diambil += 1
                    if misi.ambil_komentar and p.get("replyCount"):
                        thread = sesi.get(f"{API}/app.bsky.feed.getPostThread",
                                          {"uri": p["uri"], "depth": misi.kedalaman_komentar,
                                           "parentHeight": 0}).json().get("thread", {})
                        for t in self._balasan(thread):
                            yield t
                            diambil += 1
                if not data.get("cursor") or not semua:
                    break
                params["cursor"] = data["cursor"]

    def _balasan(self, node: dict) -> Iterator[Temuan]:
        for r in node.get("replies") or []:
            if "post" in r:  # balasan yang dihapus/diblokir tidak punya "post"
                yield _temuan(r["post"], "komentar", induk=node["post"])
                yield from self._balasan(r)
