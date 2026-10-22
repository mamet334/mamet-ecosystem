"""Uji: paket `crawler` yang termuat adalah yang ada di folder ini, bukan salinan lain di laptop.

Crawler ini disalin dari folder asalnya beserta `.venv`-nya. `.venv` asal memasang crawler dalam mode editable, yang
menyimpan alamat folder asal — tanpa pembersihan, `import crawler` bisa diam-diam memuat kode lama di folder asal,
dan setiap perubahan di sini tidak terpakai tanpa satu pun galat (Item 129 Tahap A, Mamet Ecosystem)."""

from pathlib import Path

import crawler


def test_paket_crawler_dimuat_dari_folder_ini():
    folder_ini = Path(__file__).resolve().parent.parent
    dimuat = Path(crawler.__file__).resolve().parent.parent
    assert dimuat == folder_ini, f"crawler dimuat dari {dimuat}, bukan dari {folder_ini}"
