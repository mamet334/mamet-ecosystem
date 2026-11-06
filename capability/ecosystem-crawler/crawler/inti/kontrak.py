"""Kontrak adapter sumber. Setiap tool asli dibungkus satu kelas turunan Sumber (ADR-CRW-0007)."""

from abc import ABC, abstractmethod
from collections.abc import Callable, Iterator

from crawler import konfig

from .model import Misi, Temuan

Pelapor = Callable[..., None]

class Sumber(ABC):
    id: str
    kanal: str
    jenis_akses: str
    kemampuan: tuple[str, ...] = ()
    bahasa: tuple[str, ...] = ("semua",)
    cocok_untuk: tuple[str, ...] = ()
    butuh_kredensial: str = ""
    berbayar: bool = False
    batas_laju: str = ""
    alat: tuple[dict, ...] = ()
    kecualikan_penulis_default: tuple[str, ...] = ()
    pseudonim_penulis: bool = True

    def kesehatan(self) -> str:
        """Pemeriksaan cepat tanpa jaringan: 'siap', atau alasan tidak siap."""
        return "siap"

    @abstractmethod
    def ambil(self, misi: Misi, batas: int, lapor: Pelapor) -> Iterator[Temuan]:
        """Hasilkan Temuan; item induk wajib keluar sebelum komentarnya."""

    @staticmethod
    def jatah_per_kata_kunci(misi: Misi, batas: int) -> int:
        """Bagi batas rata ke semua kata kunci, agar kata kunci pertama tidak menghabiskan seluruh jatah."""
        n = max(1, len(misi.kata_kunci))
        return max(1, -(-batas // n))

    def katalog(self, aktif: bool = True) -> dict:
        return {
            "id": self.id,
            "kanal": self.kanal,
            "jenis_akses": self.jenis_akses,
            "kemampuan": list(self.kemampuan),
            "bahasa": list(self.bahasa),
            "cocok_untuk": list(self.cocok_untuk),
            "butuh_kredensial": self.butuh_kredensial,
            "aktif": aktif,
            "berbayar": self.berbayar,
            "batas_laju": self.batas_laju,
            "confidence_dasar": konfig.CONFIDENCE_DASAR[self.jenis_akses],
            "kesehatan": self.kesehatan(),
            "kecualikan_penulis_default": list(self.kecualikan_penulis_default),
            "alat": list(self.alat),
        }
