"""Uji: teks yang dibaca AI tidak menyatakan keadaan sakelar akses sebagai fakta tetap (ADR-CRW-0010).

Dulu instruksi server MCP dan keterangan sumber menulis "robots.txt dipatuhi … tidak menyamar" (aturan ADR-CRW-0009),
padahal sakelarnya sudah ada dan bawaannya mati. AI yang bertanya "apakah crawler mematuhi robots.txt?" akan dijawab
"ya" oleh teks itu, apa pun isi `.env`. Kini keadaannya dibaca dari konfig lewat `akses` di `katalog`."""

import json

import pytest

from crawler import konfig
from crawler.wajah import mcp_server


@pytest.fixture
def katalog_dengan(monkeypatch, tmp_path):
    monkeypatch.setattr(konfig, "DATA_DIR", tmp_path / "data")
    monkeypatch.setattr(konfig, "garam", lambda: "garam-uji")

    def jalan(patuhi_robots: bool, stealth: bool) -> dict:
        monkeypatch.setattr(konfig, "PATUHI_ROBOTS", patuhi_robots)
        monkeypatch.setattr(konfig, "STEALTH", stealth)
        return mcp_server.katalog()

    return jalan


@pytest.mark.parametrize("patuhi_robots,stealth", [(False, True), (True, False), (True, True), (False, False)])
def test_katalog_melaporkan_sakelar_akses_sesuai_konfig(katalog_dengan, patuhi_robots, stealth):
    a = katalog_dengan(patuhi_robots, stealth)["akses"]
    assert a["patuhi_robots"] is patuhi_robots and a["stealth"] is stealth
    assert ("TIDAK dipatuhi" in a["keterangan"]) is (not patuhi_robots)
    assert ("stealth NYALA" in a["keterangan"]) is stealth
    assert "tidak menjawab CAPTCHA" in a["keterangan"]


def test_tak_ada_teks_untuk_ai_yang_menyatakan_robots_dipatuhi_saat_sakelar_mati(katalog_dengan):
    teks = mcp_server.INSTRUKSI + json.dumps(katalog_dengan(False, True), ensure_ascii=False)
    assert "robots.txt dipatuhi" not in teks
    assert "tidak menyamar" not in teks
    assert "`akses`" in mcp_server.INSTRUKSI  # AI diarahkan membaca keadaan sakelar, bukan mengingatnya
