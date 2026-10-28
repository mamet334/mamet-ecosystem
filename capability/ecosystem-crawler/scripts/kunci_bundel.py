"""Tulis ulang requirements-bundel.txt dari .venv crawler, LENGKAP DENGAN HASH (T20, 2026-10-28).

    .venv/Scripts/python.exe -I scripts/kunci_bundel.py           tulis ulang daftar kunci
    .venv/Scripts/python.exe -I scripts/kunci_bundel.py --periksa hanya bandingkan; kode keluar 1 bila berbeda

Kenapa hash: build.yml membangun .venv bundel di mesin GitHub dari daftar ini. Versi sudah dikunci dan --no-deps,
tetapi tanpa hash pip menerima BERKAS APA PUN yang diberikan indeks untuk versi itu. Pelajaran pekan "Black October"
(LiteLLM 1.107.0 palsu di PyPI): dengan --require-hashes, berkas yang isinya beda dari yang dicatat di sini ditolak.

Versi = `pip freeze --all` .venv ini (yang sudah diuji). Hash = digest sha256 yang dicatat PyPI untuk versi itu,
HANYA berkas yang bisa dipasang Python ini (tag wheel cocok, atau sdist) — mesin build memakai Python & Windows yang
sama (build.yml mengunci python-version = versi .venv; dijaga uji-konektor-komponen). Tak ada paket yang diunduh:
yang dibaca hanya metadata JSON PyPI.
"""
import json
import subprocess
import sys
import urllib.request
from pathlib import Path

from pip._vendor.packaging.tags import sys_tags
from pip._vendor.packaging.utils import canonicalize_name, parse_wheel_filename

BERKAS = Path(__file__).resolve().parent.parent / "requirements-bundel.txt"

KEPALA = """\
# KUNCI PAKET BUNDEL CRAWLER (Item 129) — versi dari .venv pengembangan yang SUDAH diuji, hash dari PyPI.
# Dipakai build.yml: mesin build GitHub tidak punya .venv (tidak di-commit, repo publik), jadi ia membangunnya dari
# daftar ini dengan --no-deps --require-hashes — versi yang sama persis, termasuk dependensi turunan yang tidak dikunci
# pyproject.toml, dan berkas yang isinya sama persis (T20, 2026-10-28).
# scripts/siapkan-crawler.mjs lalu membuang playwright/patchright/pytest dari bundel (K14) — patchright tetap di sini
# karena versinya dikunci ke stealth.json.
# JANGAN disunting tangan. Perbarui .venv dulu (pasang & uji), lalu: .venv/Scripts/python.exe -I scripts/kunci_bundel.py
"""


def terpasang() -> list[tuple[str, str]]:
    keluaran = subprocess.run([sys.executable, "-m", "pip", "freeze", "--all", "--disable-pip-version-check"],
                              capture_output=True, text=True, check=True).stdout
    pasangan = []
    for baris in keluaran.splitlines():
        baris = baris.strip()
        if not baris:
            continue
        if "==" not in baris or baris.startswith("-e"):
            raise SystemExit(f"baris freeze bukan nama==versi (paket editable/lokal tidak boleh masuk bundel): {baris}")
        nama, versi = baris.split("==", 1)
        pasangan.append((nama, versi))
    return pasangan


def hash_pypi(nama: str, versi: str, tag_cocok: set) -> list[str]:
    with urllib.request.urlopen(f"https://pypi.org/pypi/{nama}/{versi}/json", timeout=30) as r:
        berkas = json.load(r)["urls"]
    hasil = []
    for b in berkas:
        if b.get("yanked"):
            continue
        if b["packagetype"] == "bdist_wheel":
            _, _, _, tags = parse_wheel_filename(b["filename"])
            if not tags & tag_cocok:
                continue
        elif b["packagetype"] != "sdist":
            continue
        hasil.append(b["digests"]["sha256"])
    if not hasil:
        raise SystemExit(f"{nama}=={versi}: PyPI tidak punya berkas yang bisa dipasang Python ini")
    return sorted(hasil)


def susun() -> str:
    tag_cocok = set(sys_tags())
    baris = [KEPALA]
    for nama, versi in sorted(terpasang(), key=lambda p: canonicalize_name(p[0])):
        hs = hash_pypi(nama, versi, tag_cocok)
        baris.append(f"{nama}=={versi} \\\n" + " \\\n".join(f"    --hash=sha256:{h}" for h in hs) + "\n")
    return "".join(baris)


if __name__ == "__main__":
    baru = susun()
    if "--periksa" in sys.argv:
        lama = BERKAS.read_text(encoding="utf-8").replace("\r\n", "\n") if BERKAS.exists() else ""
        print("cocok" if lama == baru else "BERBEDA — jalankan tanpa --periksa untuk menulis ulang")
        sys.exit(0 if lama == baru else 1)
    BERKAS.write_text(baru, encoding="utf-8", newline="\n")
    print(f"ditulis {BERKAS.name}: {baru.count('==')} paket, {baru.count('--hash=')} hash")
