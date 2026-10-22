"""Akses HTTP yang sopan: jeda acak antar-permintaan, mundur saat 429/5xx, coba ulang saat koneksi putus
(ADR-CRW-0004 butir 3). Tingkat 1 tangga eskalasi (curl_cffi) menyusul di M3 dengan antarmuka yang sama."""

import logging
import random
import time

import requests

from crawler import konfig

log = logging.getLogger(__name__)

TUNGGU_ULANG = (15, 45)  # detik; setelah itu menyerah


class SesiSopan:
    def __init__(self, user_agent: str, jeda: tuple[float, float] = (0.5, 1.5), timeout: int = 20,
                 proxy: str | None = None):
        self.session = requests.Session()
        self.session.headers["User-Agent"] = user_agent
        # proxy=None -> pakai CRAWLER_PROXY dari .env; proxy="" -> paksa koneksi langsung.
        proksi = konfig.proxies(proxy)
        if proksi:
            self.session.proxies.update(proksi)
        self.jeda = jeda
        self.timeout = timeout
        self._terakhir = 0.0

    def get(self, url: str, params: dict | None = None) -> requests.Response:
        for tunggu in (*TUNGGU_ULANG, None):
            self._jeda()
            try:
                resp = self.session.get(url, params=params, timeout=self.timeout)
            except (requests.ConnectionError, requests.Timeout) as exc:
                if tunggu is None:
                    raise
                log.info("Koneksi ke %s terputus (%s), coba lagi dalam %d detik...", url, type(exc).__name__, tunggu)
                time.sleep(tunggu)
                continue
            if resp.status_code == 429 or resp.status_code >= 500:
                if tunggu is not None:
                    log.info("%s menjawab %d, tunggu %d detik...", url, resp.status_code, tunggu)
                    time.sleep(tunggu)
                    continue
            resp.raise_for_status()
            return resp
        raise AssertionError("tidak terjangkau")

    def _jeda(self) -> None:
        tunggu = self._terakhir + random.uniform(*self.jeda) - time.monotonic()
        if tunggu > 0:
            time.sleep(tunggu)
        self._terakhir = time.monotonic()
