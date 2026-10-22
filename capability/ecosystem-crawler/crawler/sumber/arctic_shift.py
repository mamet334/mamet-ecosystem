"""Kanal laptop: arsip Reddit Arctic Shift (arctic-shift.photon-reddit.com), API riset yang diizinkan robots.txt
(ADR-CRW-0009). Pengganti Reddit RSS selama kredensial PRAW belum ada. Data dari pihak ketiga, bisa terlambat
beberapa jam dibanding Reddit."""

import time
from collections.abc import Iterator
from datetime import datetime, timezone

import requests

from crawler import konfig
from crawler.inti import Misi, Pelapor, Sumber, Temuan
from crawler.inti.teks import bersihkan
from crawler.kanal import SesiSopan

API = "https://arctic-shift.photon-reddit.com/api"
TUNGGU_422 = (5, 15)  # detik


def _waktu(detik) -> str:
    return datetime.fromtimestamp(detik, timezone.utc).isoformat() if detik else ""


class ArcticShift(Sumber):
    id = "arctic_shift"
    kanal = "laptop"
    jenis_akses = "api_resmi"
    kemampuan = ("cari", "komentar")
    bahasa = ("semua",)
    cocok_untuk = ("diskusi", "keluhan", "cari_alternatif", "cerita_pengalaman")
    batas_laju = "jeda 1-2 detik per permintaan"
    alat = (
        {"nama": "Arctic Shift API", "repo": "github.com/ArthurHeitmann/arctic_shift", "lisensi": "-"},
        {"nama": "requests", "repo": "github.com/psf/requests", "lisensi": "Apache-2.0"},
    )

    def ambil(self, misi: Misi, batas: int, lapor: Pelapor) -> Iterator[Temuan]:
        if not misi.kata_kunci:
            raise ValueError("arctic_shift butuh kata_kunci")
        opsi = misi.opsi(self.id)
        subreddit = opsi.get("subreddit", ["indonesia"])
        subreddit = [s for s in (subreddit.split("+") if isinstance(subreddit, str) else subreddit) if s]
        sesi = SesiSopan(konfig.USER_AGENT, jeda=(1.0, 2.0))
        maks_utas = int(opsi.get("maks_utas_komentar", 10))
        jatah = self.jatah_per_kata_kunci(misi, batas)
        utas_komentar = 0

        for sub in subreddit:
            for kw in misi.kata_kunci:
                params = {"subreddit": sub, "query": kw, "limit": min(jatah, 100), "sort": "desc"}
                if misi.dari:
                    params["after"] = misi.dari
                if misi.sampai:
                    params["before"] = misi.sampai
                try:
                    posts = self._get(sesi, "posts/search", params, lapor).get("data") or []
                except requests.HTTPError as exc:  # satu kata kunci gagal, kata kunci lain tetap jalan
                    lapor("Sumber.KataKunciDilewati", subreddit=sub, kata_kunci=kw, alasan=str(exc)[:160])
                    continue
                lapor("Sumber.HasilKataKunci", subreddit=sub, kata_kunci=kw, jumlah=len(posts))
                for p in posts:
                    url = f"https://www.reddit.com{p.get('permalink', '')}"
                    yield Temuan(
                        jenis="postingan", id_asli=f"t3_{p['id']}", judul=bersihkan(p.get("title")),
                        teks=bersihkan(p.get("selftext")) or bersihkan(p.get("title")), url=url,
                        penulis=p.get("author", ""), waktu_terbit=_waktu(p.get("created_utc")),
                        metrik={"skor": p.get("score"), "komentar": p.get("num_comments"), "subreddit": sub},
                        mentah=p,
                    )
                    if misi.ambil_komentar and p.get("num_comments") and utas_komentar < maks_utas:
                        utas_komentar += 1
                        try:
                            pohon = self._get(sesi, "comments/tree", {"link_id": p["id"], "limit": 100}, lapor)
                        except requests.HTTPError as exc:
                            lapor("Sumber.KomentarDilewati", postingan=p["id"], alasan=str(exc)[:160])
                            continue
                        yield from self._komentar(pohon.get("data") or [], url, 0, misi.kedalaman_komentar)

    @staticmethod
    def _get(sesi: SesiSopan, jalur: str, params: dict, lapor: Pelapor) -> dict:
        """Arctic Shift menjawab 422 'Timeout. Maybe slow down a bit' saat sibuk: tunggu lalu coba lagi."""
        for tunggu in (*TUNGGU_422, None):
            try:
                return sesi.get(f"{API}/{jalur}", params).json()
            except requests.HTTPError as exc:
                if exc.response.status_code != 422 or tunggu is None:
                    raise
                lapor("Sumber.ServerSibuk", jalur=jalur, tunggu_detik=tunggu)
                time.sleep(tunggu)
        raise AssertionError("tidak terjangkau")

    def _komentar(self, simpul: list, url_post: str, kedalaman: int, maks: int) -> Iterator[Temuan]:
        if kedalaman >= maks:
            return
        for n in simpul:
            if n.get("kind") != "t1":
                continue
            c = n["data"]
            if c.get("author") == "AutoModerator" or c.get("body") in ("[deleted]", "[removed]"):
                continue
            yield Temuan(
                jenis="komentar", id_asli=f"t1_{c['id']}", teks=bersihkan(c.get("body")),
                url=f"https://www.reddit.com{c.get('permalink', '')}" if c.get("permalink") else url_post,
                url_induk=url_post, id_asli_induk=c.get("parent_id", ""), penulis=c.get("author", ""),
                waktu_terbit=_waktu(c.get("created_utc")), metrik={"skor": c.get("score"), "kedalaman": kedalaman},
                mentah={k: v for k, v in c.items() if k != "replies"},
            )
            balasan = c.get("replies")
            if isinstance(balasan, dict):
                yield from self._komentar(balasan.get("data", {}).get("children", []), url_post, kedalaman + 1, maks)
