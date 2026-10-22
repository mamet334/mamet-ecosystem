"""Akses halaman web publik dengan tangga eskalasi (ADR-CRW-0001 butir 5, ADR-CRW-0010).

    tingkat 1: requests, identitas jujur crawler
    tingkat 2: curl_cffi, sidik jari TLS browser Chrome
    tingkat 3: Scrapling StealthyFetcher (Camoufox) -- browser stealth, menyamarkan sidik jari

Naik tingkat hanya bila terdeteksi blokir. Tingkat 3 (stealth) dipakai hanya bila dinyalakan (konfig.STEALTH) dan
Scrapling[fetchers] + browser-nya sudah terpasang; bila belum, halaman yang terblokir dilewati dan dicatat.

solve_cloudflare SENGAJA tidak diaktifkan: stealth boleh mencegah tantangan muncul, tetapi crawler tidak menjawab
tantangan/CAPTCHA yang sudah muncul (ADR-CRW-0010 butir 4).

Kepatuhan robots.txt adalah sakelar Owner (konfig.PATUHI_ROBOTS, default mati di ADR-CRW-0010)."""

import logging
import random
import time
from urllib.parse import urlsplit
from urllib.robotparser import RobotFileParser

import requests
from curl_cffi import requests as curl_requests

from crawler import NAMA, konfig

log = logging.getLogger(__name__)

# Penanda halaman tantangan anti-bot (Cloudflare, DDoS-Guard, dll.), dicari di awal halaman.
PENANDA_BLOKIR = ("checking your browser", "just a moment...", "cf-chl", "cf-browser-verification",
                  "ddos-guard", "attention required! | cloudflare")
STATUS_BLOKIR = (403, 429, 503)


class DilarangRobots(Exception):
    pass


class Terblokir(Exception):
    pass


def _terblokir(status: int, html: str) -> bool:
    if status in STATUS_BLOKIR:
        return True
    awal = html[:6000].lower()
    return any(p in awal for p in PENANDA_BLOKIR)


class AksesWeb:
    def __init__(self, user_agent: str, jeda: tuple[float, float] = (1.0, 2.0), timeout: int = 25,
                 proxy: str | None = None, patuhi_robots: bool | None = None, stealth: bool | None = None):
        self.user_agent = user_agent
        self.jeda = jeda
        self.timeout = timeout
        # proxy=None -> pakai CRAWLER_PROXY dari .env; proxy="" -> paksa koneksi langsung.
        self.proxies = konfig.proxies(proxy)
        self.proxy = (proxy if proxy is not None else konfig.PROXY).strip()
        self.patuhi_robots = konfig.PATUHI_ROBOTS if patuhi_robots is None else patuhi_robots
        self.stealth = konfig.STEALTH if stealth is None else stealth
        self.session = requests.Session()
        self.session.headers["User-Agent"] = user_agent
        if self.proxies:
            self.session.proxies.update(self.proxies)
        self._robots: dict[str, RobotFileParser] = {}
        self._terakhir = 0.0

    def boleh(self, url: str) -> bool:
        if not self.patuhi_robots:  # sakelar Owner (ADR-CRW-0010): default tidak dipatuhi
            return True
        s = urlsplit(url)
        akar = f"{s.scheme}://{s.netloc}"
        rp = self._robots.get(akar)
        if rp is None:
            rp = RobotFileParser()
            try:
                resp = self.session.get(f"{akar}/robots.txt", timeout=self.timeout)
                # RFC 9309: 4xx = robots.txt tidak tersedia (boleh); 5xx = tidak terjangkau (anggap dilarang).
                if resp.status_code >= 500:
                    rp.disallow_all = True
                elif resp.status_code >= 400:
                    rp.allow_all = True
                else:
                    rp.parse(resp.text.splitlines())
            except requests.RequestException:
                rp.allow_all = True  # robots.txt tidak terjangkau: perlakukan seperti tidak ada
            self._robots[akar] = rp
        return rp.can_fetch(NAMA, url)

    def ambil(self, url: str, lapor=None) -> tuple[str, int, str]:
        """Kembalikan (html, tingkat, url_akhir). Melempar DilarangRobots atau Terblokir."""
        if not self.boleh(url):
            raise DilarangRobots(f"robots.txt melarang {url}")

        self._jeda()
        try:
            resp = self.session.get(url, timeout=self.timeout)
            if not _terblokir(resp.status_code, resp.text):
                resp.raise_for_status()
                return resp.text, 1, resp.url
            alasan = f"HTTP {resp.status_code}"
        except requests.RequestException as exc:
            if isinstance(exc, requests.HTTPError):
                raise
            alasan = type(exc).__name__

        if lapor:
            lapor("Adapter.FallbackTriggered", dari="http", ke="curl_cffi", url=url, alasan=alasan)
        self._jeda()
        resp = curl_requests.get(url, impersonate="chrome", timeout=self.timeout, proxies=self.proxies)
        if not _terblokir(resp.status_code, resp.text):
            resp.raise_for_status()
            return resp.text, 2, str(resp.url)

        if not self.stealth:
            raise Terblokir(f"diblokir di tingkat 2 (HTTP {resp.status_code}); stealth dimatikan")
        if lapor:
            lapor("Adapter.FallbackTriggered", dari="curl_cffi", ke="stealth", url=url,
                  alasan=f"HTTP {resp.status_code}")
        return self._stealth(url)

    def _stealth(self, url: str) -> tuple[str, int, str]:
        """Tingkat 3: Scrapling StealthyFetcher (Camoufox). Impor malas agar crawler tetap jalan bila
        Scrapling[fetchers] atau browser-nya belum terpasang."""
        try:
            from scrapling.fetchers import StealthyFetcher
        except ImportError as exc:
            raise Terblokir("stealth belum siap: 'pip install \"scrapling[fetchers]\"' lalu "
                            f"'scrapling install' ({type(exc).__name__})") from None
        self._jeda()
        try:
            resp = StealthyFetcher.fetch(
                url,
                headless=True,
                network_idle=True,
                timeout=self.timeout * 1000,  # Scrapling pakai milidetik
                google_search=True,            # referer Google, seperti pengunjung dari pencarian
                solve_cloudflare=False,        # TIDAK menjawab tantangan/CAPTCHA (ADR-CRW-0010 butir 4)
                proxy=self.proxy or None,
            )
        except Exception as exc:  # browser belum diunduh, timeout, dll.
            pesan = str(exc)
            if "scrapling install" in pesan.lower() or "executable" in pesan.lower():
                raise Terblokir("browser stealth belum diunduh: jalankan 'scrapling install'") from None
            raise Terblokir(f"stealth gagal: {type(exc).__name__}: {pesan[:120]}") from None
        html = resp.html_content or ""
        if _terblokir(resp.status, html):
            raise Terblokir(f"tetap diblokir di tingkat 3/stealth (HTTP {resp.status}); kemungkinan tantangan "
                            "aktif yang tidak dijawab")
        return html, 3, str(resp.url)

    def _jeda(self) -> None:
        tunggu = self._terakhir + random.uniform(*self.jeda) - time.monotonic()
        if tunggu > 0:
            time.sleep(tunggu)
        self._terakhir = time.monotonic()
