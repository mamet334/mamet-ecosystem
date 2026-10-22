"""Lokasi folder, nilai dari .env, dan nilai awal yang bisa diatur Owner."""

import json
import logging
import os
import re
import secrets
from pathlib import Path

from dotenv import load_dotenv

log = logging.getLogger(__name__)

# Akar proyek: folder yang berisi paket `crawler/`. Bisa ditimpa dengan CRAWLER_ROOT (dipakai uji).
ROOT = Path(os.environ.get("CRAWLER_ROOT") or Path(__file__).resolve().parent.parent)
ENV_PATH = ROOT / ".env"
load_dotenv(ENV_PATH)

DATA_DIR = ROOT / "data"
HASIL_DIR = ROOT / "hasil"
INBOX_DIR = ROOT / "inbox"
KONFIGURASI_PATH = DATA_DIR / "konfigurasi.json"

USER_AGENT = os.environ.get("CRAWLER_USER_AGENT") or "ecosystem-crawler/0.1 (riset pribadi)"
# Proxy opsional (ADR-CRW-0010 pembahasan). Mis. http://user:sandi@host:port atau socks5://host:port.
# Kosong = pakai koneksi langsung (IP rumah). Boleh berisi kredensial, jadi disimpan di .env, bukan kode.
PROXY = os.environ.get("CRAWLER_PROXY", "").strip()
# Email kontak opsional untuk "polite pool" OpenAlex (permintaan lebih diprioritaskan). Kosong = tetap jalan.
MAILTO = os.environ.get("CRAWLER_MAILTO", "").strip()


def _bool_env(nama: str, default: bool) -> bool:
    nilai = os.environ.get(nama, "").strip().lower()
    return default if nilai == "" else nilai in ("1", "true", "ya", "on", "yes")


# Sakelar Owner (ADR-CRW-0010). Default: robots.txt tidak dipatuhi, tingkat stealth menyala.
PATUHI_ROBOTS = _bool_env("CRAWLER_PATUHI_ROBOTS", False)
STEALTH = _bool_env("CRAWLER_STEALTH", True)
REDDIT_CLIENT_ID = os.environ.get("REDDIT_CLIENT_ID", "")
REDDIT_CLIENT_SECRET = os.environ.get("REDDIT_CLIENT_SECRET", "")
YOUTUBE_API_KEY = os.environ.get("YOUTUBE_API_KEY", "")

# Keandalan pengambilan per jenis akses, bukan kebenaran isi (ADR-CRW-0001 butir 7).
CONFIDENCE_DASAR = {
    "api_resmi": 0.90,
    "feed": 0.85,
    "intercept_json": 0.80,
    "apify": 0.75,
    "html": 0.70,
    "manual": 0.50,
}


def proxies(proxy: str | None = None) -> dict | None:
    """Format proxy untuk requests/curl_cffi: {'http': ..., 'https': ...}, atau None bila tidak dipakai."""
    p = (proxy if proxy is not None else PROXY).strip()
    return {"http": p, "https": p} if p else None


def proxy_tersamar(proxy: str | None = None) -> str:
    """Alamat proxy dengan kata sandi disembunyikan, untuk ditampilkan ke Owner tanpa membocorkan rahasia."""
    p = (proxy if proxy is not None else PROXY).strip()
    if not p:
        return "(tidak ada, pakai IP langsung)"
    return re.sub(r"//([^:/@]+):[^@/]+@", r"//\1:***@", p)


def garam() -> str:
    """Garam pseudonim dari .env; dibuat sekali bila belum ada (ADR-CRW-0002 butir 4)."""
    nilai = os.environ.get("CRAWLER_GARAM", "").strip()
    if nilai:
        return nilai
    nilai = secrets.token_hex(32)
    ada = ENV_PATH.read_text(encoding="utf-8") if ENV_PATH.exists() else ""
    if "CRAWLER_GARAM=" in ada:
        # Baris ada tetapi kosong: isi di tempat agar tidak ada dua baris.
        ada = "\n".join(f"CRAWLER_GARAM={nilai}" if b.startswith("CRAWLER_GARAM=") else b for b in ada.splitlines())
        ENV_PATH.write_text(ada + "\n", encoding="utf-8")
    else:
        with ENV_PATH.open("a", encoding="utf-8") as f:
            f.write(("" if not ada or ada.endswith("\n") else "\n") + f"CRAWLER_GARAM={nilai}\n")
    os.environ["CRAWLER_GARAM"] = nilai
    log.info("Garam pseudonim baru dibuat di %s. Jangan diganti setelah ada data.", ENV_PATH)
    return nilai


def baca_konfigurasi() -> dict:
    """Pengaturan Owner yang bisa diubah tanpa kode (Configure())."""
    try:
        return json.loads(KONFIGURASI_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {"nonaktif": []}


def simpan_konfigurasi(data: dict) -> None:
    KONFIGURASI_PATH.parent.mkdir(parents=True, exist_ok=True)
    KONFIGURASI_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
