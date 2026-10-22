"""Kanal laptop: thread Kaskus dari url_awal.

Pencarian dan daftar balasan Kaskus dimuat lewat /api/, yang dilarang robots.txt Kaskus, jadi crawler tidak
memakainya (ADR-CRW-0004). Halaman thread sendiri boleh diambil, dan isi postingan pembukanya tertanam di data
__NEXT_DATA__. Akibatnya: link thread dicari oleh perencana (mis. mesin pencari Claude), dan yang diambil adalah
postingan pembuka beserta jumlah balasan, bukan isi balasannya."""

import json
import re
from collections.abc import Iterator
from datetime import datetime, timezone
from urllib.parse import urlsplit

from crawler import konfig
from crawler.inti import Misi, Pelapor, Sumber, Temuan
from crawler.inti.teks import bersihkan
from crawler.kanal import AksesWeb, DilarangRobots, Terblokir

_NEXT_DATA = re.compile(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', re.DOTALL)
DOMAIN = ("kaskus.co.id", "kask.us")


def url_kaskus(url: str) -> bool:
    host = urlsplit(url).netloc.lower()
    return any(host == d or host.endswith("." + d) for d in DOMAIN)


def _ke_www(url: str) -> str:
    """m.kaskus.co.id dan halaman 2, 3, ... diarahkan ke halaman pertama versi www."""
    s = urlsplit(url)
    m = re.match(r"(/thread/[0-9a-f]+/[^/]+)", s.path)
    return f"https://www.kaskus.co.id{m.group(1) if m else s.path}"


class Kaskus(Sumber):
    id = "kaskus"
    kanal = "laptop"
    jenis_akses = "intercept_json"
    kemampuan = ("url_langsung",)
    bahasa = ("id",)
    cocok_untuk = ("forum_indonesia", "cerita_pengalaman", "peluang_usaha", "keluhan", "diskusi")
    batas_laju = "jeda 1-2 detik per thread"
    alat = (
        {"nama": "requests", "repo": "github.com/psf/requests", "lisensi": "Apache-2.0"},
        {"nama": "curl_cffi", "repo": "github.com/lexiforest/curl_cffi", "lisensi": "MIT"},
    )

    def ambil(self, misi: Misi, batas: int, lapor: Pelapor) -> Iterator[Temuan]:
        urls = list(dict.fromkeys(_ke_www(u) for u in misi.url_awal if url_kaskus(u)))
        if not urls:
            raise ValueError("kaskus butuh url_awal berisi link thread Kaskus (cari lewat mesin pencari, "
                             "mis. 'site:kaskus.co.id <topik>'); pencarian Kaskus dilarang robots.txt")
        web = AksesWeb(konfig.USER_AGENT)
        for url in urls[:batas]:
            try:
                html, tingkat, _ = web.ambil(url, lapor)
            except (DilarangRobots, Terblokir) as exc:
                lapor("Sumber.HalamanDilewati", url=url, alasan=str(exc))
                continue
            m = _NEXT_DATA.search(html)
            fallback = json.loads(m.group(1))["props"]["pageProps"].get("fallback", {}) if m else {}
            thread = next((v["data"] for v in fallback.values() if isinstance(v, dict) and "first_post" in
                           v.get("data", {})), None)
            if not thread:
                lapor("Sumber.HalamanDilewati", url=url, alasan="data thread tidak ditemukan di halaman")
                continue
            post = thread.get("first_post") or {}
            meta = thread.get("meta") or {}
            yield Temuan(
                jenis="postingan", id_asli=f"thread:{thread['id']}", judul=bersihkan(thread.get("title")),
                teks=bersihkan((post.get("content") or thread.get("content") or {}).get("text")), url=url,
                penulis=(thread.get("thread_starter") or {}).get("username", ""),
                waktu_terbit=datetime.fromtimestamp(thread["dateline"], timezone.utc).isoformat()
                if thread.get("dateline") else "",
                bahasa="id",
                metrik={"dilihat": meta.get("total_views"), "balasan": meta.get("total_replies"),
                        "komunitas": (thread.get("community") or {}).get("name"), "tingkat_akses": tingkat},
                mentah=thread,
            )
