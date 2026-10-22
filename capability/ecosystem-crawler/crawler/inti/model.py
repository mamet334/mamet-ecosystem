"""Format Misi (ADR-CRW-0003, ADR-CRW-0007 butir 7) dan Temuan dari adapter sumber."""

from dataclasses import asdict, dataclass, field
from typing import Any

from .teks import ulid

TIPE_MISI = "crawler.misi.jalankan"


class MisiTidakValid(ValueError):
    pass


@dataclass
class Misi:
    sumber: list[str]
    kata_kunci: list[str] = field(default_factory=list)
    kata_kunci_kecuali: list[str] = field(default_factory=list)
    url_awal: list[str] = field(default_factory=list)
    dari: str = ""            # YYYY-MM-DD, inklusif
    sampai: str = ""          # YYYY-MM-DD, inklusif
    batas_per_sumber: int = 100
    batas_total: int = 1000
    ambil_komentar: bool = False
    kedalaman_komentar: int = 1
    buka_identitas_penulis: bool = False
    opsi_sumber: dict = field(default_factory=dict)
    bahasa: list[str] = field(default_factory=lambda: ["id"])
    wilayah: str = "ID"
    owner_intent: str = ""
    trace_id: str = ""
    id: str = ""
    type: str = TIPE_MISI

    def __post_init__(self):
        self.id = self.id or ulid()
        self.trace_id = self.trace_id or f"lokal-{self.id}"
        if not self.sumber:
            raise MisiTidakValid("misi wajib menyebut minimal satu sumber")
        if self.batas_per_sumber < 1 or self.batas_total < 1:
            raise MisiTidakValid("batas harus lebih dari 0")
        if self.kedalaman_komentar < 1:
            raise MisiTidakValid("kedalaman komentar minimal 1")

    def opsi(self, sumber: str) -> dict:
        return self.opsi_sumber.get(sumber) or {}

    @classmethod
    def dari_input(cls, data: dict) -> "Misi":
        """Format masuk Mamet {type, context, payload, trace_id}; payload datar juga diterima."""
        if "payload" not in data:
            data = {"payload": data}
        p, ctx = data.get("payload") or {}, data.get("context") or {}
        rentang, batas, komentar = p.get("rentang_waktu") or {}, p.get("batas") or {}, p.get("komentar") or {}
        if p.get("sumber") in (None, "", "otomatis"):
            raise MisiTidakValid("payload.sumber wajib diisi eksplisit (crawler tidak memilih sumber)")
        return cls(
            sumber=_daftar(p.get("sumber")),
            kata_kunci=_daftar(p.get("kata_kunci")),
            kata_kunci_kecuali=_daftar(p.get("kata_kunci_kecuali")),
            url_awal=_daftar(p.get("url_awal")),
            dari=str(rentang.get("dari") or ""),
            sampai=str(rentang.get("sampai") or ""),
            batas_per_sumber=int(batas.get("per_sumber", 100)),
            batas_total=int(batas.get("total", 1000)),
            ambil_komentar=bool(komentar.get("ambil", False)),
            kedalaman_komentar=int(komentar.get("kedalaman", 1)),
            buka_identitas_penulis=bool(p.get("buka_identitas_penulis", False)),
            opsi_sumber=p.get("opsi_sumber") or {},
            bahasa=_daftar(ctx.get("bahasa")) or ["id"],
            wilayah=str(ctx.get("wilayah") or "ID"),
            owner_intent=str(ctx.get("owner_intent") or ""),
            trace_id=str(data.get("trace_id") or ""),
            type=str(data.get("type") or TIPE_MISI),
        )

    def ke_input(self) -> dict:
        return {
            "type": self.type,
            "context": {"owner_intent": self.owner_intent, "bahasa": self.bahasa, "wilayah": self.wilayah},
            "payload": {
                "sumber": self.sumber,
                "kata_kunci": self.kata_kunci,
                "kata_kunci_kecuali": self.kata_kunci_kecuali,
                "url_awal": self.url_awal,
                "rentang_waktu": {"dari": self.dari, "sampai": self.sampai},
                "batas": {"per_sumber": self.batas_per_sumber, "total": self.batas_total},
                "komentar": {"ambil": self.ambil_komentar, "kedalaman": self.kedalaman_komentar},
                "buka_identitas_penulis": self.buka_identitas_penulis,
                "opsi_sumber": self.opsi_sumber,
            },
            "trace_id": self.trace_id,
        }


@dataclass
class Temuan:
    """Satu item dari adapter sumber, sebelum disimpan dan dipseudonimkan oleh gudang."""

    jenis: str                      # artikel | postingan | komentar | ulasan | dokumen
    teks: str
    url: str
    id_asli: str = ""
    judul: str = ""
    penulis: str = ""               # username asli; gudang menyimpan pseudonimnya
    waktu_terbit: str = ""          # ISO-8601 UTC
    bahasa: str = ""
    metrik: dict = field(default_factory=dict)
    url_induk: str = ""
    id_asli_induk: str = ""         # id_asli item induk di sumber yang sama (utas komentar)
    jenis_akses: str = ""           # kosong = jenis akses default sumber
    mentah: Any = None              # payload asli apa adanya

    def ke_dict(self) -> dict:
        return asdict(self)


def _daftar(nilai) -> list[str]:
    if not nilai:
        return []
    if isinstance(nilai, str):
        return [s.strip() for s in nilai.split(",") if s.strip()]
    return [str(s).strip() for s in nilai if str(s).strip()]
