"""Kanal hp: video dan komentar YouTube.

Dua jalur (ADR-CRW-0010): bila YOUTUBE_API_KEY ada, pakai YouTube Data API v3 resmi (kuota 10.000 unit/hari); bila
kosong, pakai yt-dlp (tanpa kunci). Video dari pencarian kata kunci atau langsung dari url_awal."""

import logging
from collections.abc import Iterator
from datetime import datetime, timezone
from urllib.parse import parse_qs, urlsplit

import requests

from crawler import konfig
from crawler.inti import Misi, Pelapor, Sumber, Temuan
from crawler.inti.teks import bersihkan, ke_iso
from crawler.kanal import SesiSopan

log = logging.getLogger(__name__)
API = "https://www.googleapis.com/youtube/v3"


class _LogYtdlp:
    """Peringatan 'JavaScript runtime' hanya soal format video (tidak diunduh), jadi diturunkan ke debug."""

    def debug(self, msg):
        log.debug(msg)

    info = debug

    def warning(self, msg):
        (log.debug if "JavaScript runtime" in msg else log.warning)(msg)

    def error(self, msg):
        log.error(msg)


def _dari_info_ytdlp(info: dict) -> Iterator[Temuan]:
    vid = info["id"]
    url = f"https://www.youtube.com/watch?v={vid}"
    komentar = info.pop("comments", None) or []
    d = info.get("upload_date") or ""
    yield Temuan(
        jenis="video", id_asli=f"video:{vid}", judul=bersihkan(info.get("title")),
        teks=bersihkan(info.get("description")) or bersihkan(info.get("title")), url=url,
        penulis=info.get("channel") or info.get("uploader") or "",
        waktu_terbit=f"{d[:4]}-{d[4:6]}-{d[6:8]}" if len(d) == 8 else "", bahasa=info.get("language") or "",
        metrik={"tayang": info.get("view_count"), "suka": info.get("like_count"),
                "komentar": info.get("comment_count"), "durasi_detik": info.get("duration"),
                "kanal_youtube": info.get("channel")},
        mentah={k: info.get(k) for k in ("id", "title", "description", "channel", "channel_id", "upload_date",
                                         "view_count", "like_count", "comment_count", "duration", "language")},
    )
    for c in komentar:
        induk = f"video:{vid}" if c.get("parent") in (None, "", "root") else f"komentar:{c['parent']}"
        waktu = c.get("timestamp")
        yield Temuan(
            jenis="komentar", id_asli=f"komentar:{c['id']}", teks=bersihkan(c.get("text")),
            url=f"{url}&lc={c['id']}", url_induk=url, id_asli_induk=induk, penulis=c.get("author") or "",
            waktu_terbit=datetime.fromtimestamp(waktu, timezone.utc).date().isoformat() if waktu else "",
            metrik={"suka": c.get("like_count"), "disematkan": c.get("is_pinned"),
                    "dari_pengunggah": c.get("author_is_uploader"), "waktu_perkiraan": True},
            mentah=c,
        )


def _id_video(url: str) -> str:
    s = urlsplit(url)
    if s.netloc.endswith("youtu.be"):
        return s.path.strip("/")
    if "/shorts/" in s.path:
        return s.path.split("/shorts/")[1].split("/")[0]
    return (parse_qs(s.query).get("v") or [""])[0]


def _komentar(snip: dict, vid: str, induk: str) -> Temuan:
    s = snip["snippet"]
    return Temuan(
        jenis="komentar", id_asli=f"komentar:{snip['id']}", teks=bersihkan(s.get("textOriginal") or s.get("textDisplay")),
        url=f"https://www.youtube.com/watch?v={vid}&lc={snip['id']}", url_induk=f"https://www.youtube.com/watch?v={vid}",
        id_asli_induk=induk, penulis=s.get("authorDisplayName", ""), waktu_terbit=ke_iso(s.get("publishedAt")),
        metrik={"suka": s.get("likeCount")}, mentah=snip,
    )


class YouTube(Sumber):
    id = "youtube"
    kanal = "hp"
    jenis_akses = "api_resmi"
    kemampuan = ("cari", "komentar", "url_langsung")
    bahasa = ("semua",)
    cocok_untuk = ("keluhan", "opini_publik", "reaksi_berita", "tutorial", "ulasan_produk")
    butuh_kredensial = "opsional: YOUTUBE_API_KEY (tanpa itu memakai yt-dlp)"
    batas_laju = "API: kuota 10.000 unit/hari; yt-dlp: ±3 detik per video"
    alat = (
        {"nama": "YouTube Data API v3", "repo": "github.com/googleapis/google-api-python-client",
         "lisensi": "API resmi Google"},
        {"nama": "yt-dlp", "repo": "github.com/yt-dlp/yt-dlp", "lisensi": "Unlicense"},
    )

    def kesehatan(self) -> str:
        return "siap" if konfig.YOUTUBE_API_KEY else "siap (mode yt-dlp, tanpa kunci)"

    def ambil(self, misi: Misi, batas: int, lapor: Pelapor) -> Iterator[Temuan]:
        if not konfig.YOUTUBE_API_KEY:
            yield from self._ambil_ytdlp(misi, batas, lapor)
            return
        opsi = misi.opsi(self.id)
        sesi = SesiSopan(konfig.USER_AGENT, jeda=(0.2, 0.5))

        def api(jalur: str, **params) -> dict:
            # Pesan error requests memuat URL lengkap beserta kunci API; jangan sampai masuk log atau gudang.
            try:
                return sesi.get(f"{API}/{jalur}", {**params, "key": konfig.YOUTUBE_API_KEY}).json()
            except requests.HTTPError as exc:
                try:
                    alasan = exc.response.json().get("error", {}).get("errors", [{}])[0].get("reason", "")
                except ValueError:
                    alasan = ""
                raise RuntimeError(f"YouTube API {exc.response.status_code} {alasan}".strip()) from None
            except requests.RequestException as exc:
                raise RuntimeError(f"YouTube API tidak terjangkau ({type(exc).__name__})") from None

        video_ids = [v for v in (_id_video(u) for u in misi.url_awal if "youtu" in u) if v]
        for kw in misi.kata_kunci:
            params = {"part": "snippet", "q": kw, "type": "video", "maxResults": int(opsi.get("video_per_kata_kunci", 5)),
                      "order": "date" if opsi.get("urut") == "terbaru" else "relevance",
                      "regionCode": misi.wilayah or "ID"}
            if misi.bahasa and misi.bahasa[0] != "semua":
                params["relevanceLanguage"] = misi.bahasa[0]
            if misi.dari:
                params["publishedAfter"] = f"{misi.dari}T00:00:00Z"
            if misi.sampai:
                params["publishedBefore"] = f"{misi.sampai}T23:59:59Z"
            ids = [i["id"]["videoId"] for i in api("search", **params).get("items", []) if i["id"].get("videoId")]
            lapor("Sumber.HasilKataKunci", kata_kunci=kw, jumlah=len(ids))
            video_ids += ids
        video_ids = list(dict.fromkeys(video_ids))
        if not video_ids and not misi.kata_kunci:
            raise ValueError("youtube butuh kata_kunci atau url_awal berisi link video")

        maks_komentar = int(opsi.get("komentar_per_video", 30))
        for awal in range(0, len(video_ids), 50):
            for v in api("videos", part="snippet,statistics", id=",".join(video_ids[awal:awal + 50])).get("items", []):
                vid, s, st = v["id"], v["snippet"], v.get("statistics", {})
                yield Temuan(
                    jenis="video", id_asli=f"video:{vid}", judul=bersihkan(s.get("title")),
                    teks=bersihkan(s.get("description")) or bersihkan(s.get("title")),
                    url=f"https://www.youtube.com/watch?v={vid}", penulis=s.get("channelTitle", ""),
                    waktu_terbit=ke_iso(s.get("publishedAt")), bahasa=s.get("defaultAudioLanguage", ""),
                    metrik={"tayang": int(st.get("viewCount", 0)), "suka": int(st.get("likeCount", 0)),
                            "komentar": int(st.get("commentCount", 0)), "kanal_youtube": s.get("channelTitle")},
                    mentah=v,
                )
                if misi.ambil_komentar and int(st.get("commentCount", 0)):
                    yield from self._komentar_video(api, vid, maks_komentar, misi.kedalaman_komentar, opsi, lapor)

    @staticmethod
    def _komentar_video(api, vid: str, maks: int, kedalaman: int, opsi: dict, lapor: Pelapor) -> Iterator[Temuan]:
        diambil, token = 0, None
        while diambil < maks:
            params = {"part": "snippet,replies", "videoId": vid, "maxResults": min(100, maks - diambil),
                      "order": "time" if opsi.get("urut_komentar") == "new" else "relevance",
                      "textFormat": "plainText"}
            if token:
                params["pageToken"] = token
            try:
                data = api("commentThreads", **params)
            except RuntimeError as exc:  # mis. komentar dimatikan pemilik video
                lapor("Sumber.KomentarDilewati", video=vid, alasan=str(exc))
                return
            for th in data.get("items", []):
                yield _komentar(th["snippet"]["topLevelComment"], vid, f"video:{vid}")
                diambil += 1
                if kedalaman >= 2:
                    for r in (th.get("replies") or {}).get("comments", []):
                        yield _komentar(r, vid, f"komentar:{th['id']}")
            token = data.get("nextPageToken")
            if not token:
                return

    # ---- jalur yt-dlp (tanpa kunci API) ---------------------------------------------------------------------

    def _ambil_ytdlp(self, misi: Misi, batas: int, lapor: Pelapor) -> Iterator[Temuan]:
        import yt_dlp

        opsi = misi.opsi(self.id)
        dasar = {"quiet": True, "no_warnings": True, "skip_download": True, "noprogress": True, "logger": _LogYtdlp()}
        per_kw = int(opsi.get("video_per_kata_kunci", 5))
        prefix = "ytsearchdate" if opsi.get("urut") == "terbaru" else "ytsearch"

        video_ids = [v for v in (_id_video(u) for u in misi.url_awal if "youtu" in u) if v]
        with yt_dlp.YoutubeDL({**dasar, "extract_flat": True}) as ydl:
            for kw in misi.kata_kunci:
                hasil = ydl.extract_info(f"{prefix}{per_kw}:{kw}", download=False) or {}
                ids = [e["id"] for e in hasil.get("entries") or [] if e.get("id")]
                lapor("Sumber.HasilKataKunci", kata_kunci=kw, jumlah=len(ids))
                video_ids += ids
        video_ids = list(dict.fromkeys(video_ids))
        if not video_ids and not misi.kata_kunci:
            raise ValueError("youtube butuh kata_kunci atau url_awal berisi link video")

        maks_komentar = int(opsi.get("komentar_per_video", 30)) if misi.ambil_komentar else 0
        balasan = "5" if misi.kedalaman_komentar >= 2 else "0"
        opsi_video = {**dasar, "getcomments": bool(maks_komentar), "extractor_args": {"youtube": {
            "max_comments": [str(maks_komentar), "all", balasan, balasan],
            "comment_sort": [opsi.get("urut_komentar", "top")]}}}
        with yt_dlp.YoutubeDL(opsi_video) as ydl:
            for vid in video_ids:
                try:
                    info = ydl.extract_info(f"https://www.youtube.com/watch?v={vid}", download=False)
                except yt_dlp.utils.DownloadError as exc:
                    lapor("Sumber.VideoGagal", video=vid, alasan=str(exc)[:200])
                    continue
                yield from _dari_info_ytdlp(info)
