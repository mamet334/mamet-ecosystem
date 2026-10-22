"""Kanal laptop: Reddit lewat API resmi (PRAW). Butuh REDDIT_CLIENT_ID dan REDDIT_CLIENT_SECRET.

Jalur feed RSS publik dihapus karena dilarang robots.txt Reddit (ADR-CRW-0009). Tanpa kredensial, pakai sumber
`arctic_shift` (arsip Reddit untuk riset)."""

from collections.abc import Iterator
from datetime import date, datetime, timezone

from crawler import konfig
from crawler.inti import Misi, Pelapor, Sumber, Temuan
from crawler.inti.teks import bersihkan, ke_iso


def _query(keywords: list[str]) -> str:
    return " OR ".join(f'"{k}"' if " " in k else k for k in keywords)


def _time_filter(dari: str) -> str:
    if not dari:
        return "all"
    hari = (date.today() - date.fromisoformat(dari)).days
    for batas, nama in ((1, "day"), (7, "week"), (31, "month"), (366, "year")):
        if hari <= batas:
            return nama
    return "all"


class Reddit(Sumber):
    id = "reddit"
    kanal = "laptop"
    jenis_akses = "api_resmi"
    kemampuan = ("cari", "komentar")
    bahasa = ("semua",)
    cocok_untuk = ("diskusi", "keluhan", "cari_alternatif", "cerita_pengalaman")
    butuh_kredensial = "REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET (gratis, perlu persetujuan Reddit)"
    batas_laju = "100 permintaan/menit (aturan API Reddit)"
    alat = ({"nama": "PRAW", "repo": "github.com/praw-dev/praw", "lisensi": "BSD-2-Clause"},)

    def kesehatan(self) -> str:
        if konfig.REDDIT_CLIENT_ID and konfig.REDDIT_CLIENT_SECRET:
            return "siap"
        return "butuh kredensial PRAW di .env; sementara pakai sumber arctic_shift"

    def ambil(self, misi: Misi, batas: int, lapor: Pelapor) -> Iterator[Temuan]:
        import praw

        if not misi.kata_kunci:
            raise ValueError("reddit butuh kata_kunci")
        opsi = misi.opsi(self.id)
        reddit = praw.Reddit(client_id=konfig.REDDIT_CLIENT_ID, client_secret=konfig.REDDIT_CLIENT_SECRET,
                             user_agent=konfig.USER_AGENT)
        reddit.read_only = True
        posts = reddit.subreddit(opsi.get("subreddit", "all")).search(
            _query(misi.kata_kunci), sort=opsi.get("urut", "relevance"), time_filter=_time_filter(misi.dari),
            limit=min(batas, 1000))
        for p in posts:
            yield Temuan(
                jenis="postingan", id_asli=p.fullname, judul=bersihkan(p.title),
                teks=bersihkan(p.selftext) or bersihkan(p.title), url=f"https://www.reddit.com{p.permalink}",
                penulis=str(p.author or ""), waktu_terbit=ke_iso(datetime.fromtimestamp(p.created_utc, timezone.utc)),
                metrik={"skor": p.score, "komentar": p.num_comments, "subreddit": p.subreddit.display_name},
                mentah={k: v for k, v in vars(p).items() if not k.startswith("_")},
            )
            if not misi.ambil_komentar:
                continue
            p.comments.replace_more(limit=0)
            for c in p.comments.list():
                if getattr(c, "depth", 0) >= misi.kedalaman_komentar:
                    continue
                yield Temuan(
                    jenis="komentar", id_asli=c.fullname, teks=bersihkan(c.body),
                    url=f"https://www.reddit.com{c.permalink}", url_induk=f"https://www.reddit.com{p.permalink}",
                    id_asli_induk=c.parent_id, penulis=str(c.author or ""),
                    waktu_terbit=ke_iso(datetime.fromtimestamp(c.created_utc, timezone.utc)),
                    metrik={"skor": c.score, "kedalaman": getattr(c, "depth", 0)},
                    mentah={k: v for k, v in vars(c).items() if not k.startswith("_") and k != "replies"},
                )
