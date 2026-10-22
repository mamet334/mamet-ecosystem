"""Pembersih teks dan pencocokan kata kunci (pencocokan string, bukan makna)."""

import html
import os
import re
import time
from datetime import date, datetime, timedelta, timezone

_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")
_CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"


def bersihkan(text: str | None) -> str:
    """Hapus tag HTML, decode entity, rapikan spasi."""
    if not text:
        return ""
    text = re.sub(r"<(?:p|br|li)\b[^>]*>", "\n", text)
    text = html.unescape(_TAG_RE.sub("", text))
    return _WS_RE.sub(" ", text).strip()


def kata_kunci_cocok(text: str, keywords: list[str]) -> list[str]:
    """Kata kunci misi yang muncul di teks, tanpa membedakan huruf besar/kecil."""
    low = text.lower()
    return [k for k in keywords if k.lower() in low]


def ada_kata(text: str, keywords: list[str]) -> bool:
    return bool(kata_kunci_cocok(text, keywords))


def sebagai_daftar(nilai) -> list:
    """Opsi sumber bisa berupa satu nilai (mis. dari CLI '--opsi x.tag=a') atau daftar."""
    if nilai in (None, ""):
        return []
    return list(nilai) if isinstance(nilai, (list, tuple)) else [nilai]


def sekarang_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def ke_iso(nilai) -> str:
    """datetime, struct_time, atau teks ISO menjadi ISO-8601 UTC; kosong bila tidak dikenali."""
    if not nilai:
        return ""
    if isinstance(nilai, time.struct_time):
        nilai = datetime(*nilai[:6], tzinfo=timezone.utc)
    if isinstance(nilai, str):
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", nilai.strip()):
            return nilai.strip()  # tanggal saja: jangan digeser zona waktunya
        try:
            nilai = datetime.fromisoformat(nilai.replace("Z", "+00:00"))
        except ValueError:
            return nilai
    if isinstance(nilai, datetime):
        if nilai.tzinfo is None:
            nilai = nilai.astimezone()  # waktu naif dianggap waktu lokal mesin
        return nilai.astimezone(timezone.utc).isoformat(timespec="seconds")
    return str(nilai)


def tanggal_relatif(nilai: str) -> str:
    """'90h' (hari), '12mg' (minggu), '6b' (bulan) dari hari ini, atau tanggal YYYY-MM-DD."""
    if not nilai:
        return ""
    m = re.fullmatch(r"(\d+)\s*(h|mg|b)", nilai.strip().lower())
    if m:
        n, satuan = int(m.group(1)), m.group(2)
        return (date.today() - timedelta(days=n * {"h": 1, "mg": 7, "b": 30}[satuan])).isoformat()
    return date.fromisoformat(nilai.strip()).isoformat()


def ulid() -> str:
    """ID 26 karakter yang urut menurut waktu (format ULID)."""
    n = (int(time.time() * 1000) << 80) | int.from_bytes(os.urandom(10), "big")
    return "".join(_CROCKFORD[(n >> (5 * i)) & 31] for i in reversed(range(26)))
