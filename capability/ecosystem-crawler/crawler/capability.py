"""Kontrak Capability dan Adapter Mamet (03_CAPABILITY_PORT, 12_CAPABILITY_ADAPTER_SPEC).

Semua wajah (CLI, MCP, kelak HTTP) memanggil kelas ini, sehingga perilaku crawler sama di mana pun ia dipakai.
Di M1, Execute() berjalan sinkron sampai misi selesai; eksekusi asinkron menyusul bersama HTTP API (M4)."""

import logging

from crawler import NAMA, __version__, konfig
from crawler.gudang import Gudang
from crawler.inti.dispatcher import Dispatcher
from crawler.inti.model import TIPE_MISI, Misi, MisiTidakValid
from crawler.sumber import buat_registri

log = logging.getLogger(__name__)


class EcosystemCrawler:
    name = NAMA
    version = __version__
    capability_type = "search"  # mengisi Search Port dan bagian pengumpulan Research Port (ADR-CRW-0001)
    description = "Indra dan tangan: mencari, mengambil, menormalkan, dan menyimpan data mentah. Tanpa analisis."

    def __init__(self, data_dir=None):
        self.data_dir = data_dir or konfig.DATA_DIR
        self.gudang: Gudang | None = None
        self.registri = buat_registri()

    # ---- siklus hidup -----------------------------------------------------------------------------------------

    def initialize(self) -> "EcosystemCrawler":
        self.gudang = Gudang(self.data_dir, konfig.garam())
        return self

    def shutdown(self) -> None:
        if self.gudang:
            self.gudang.tutup()
            self.gudang = None

    def __enter__(self):
        return self.initialize()

    def __exit__(self, *_):
        self.shutdown()

    # ---- kontrak ----------------------------------------------------------------------------------------------

    def health_check(self) -> dict:
        sumber = {s.id: s.kesehatan() for s in self.registri.values()}
        return {"status": "sehat" if self.gudang else "belum_diinisialisasi", "sumber": sumber}

    def report_status(self) -> dict:
        nonaktif = set(konfig.baca_konfigurasi().get("nonaktif", []))
        return {
            "name": self.name, "version": self.version, "capability_type": self.capability_type,
            "description": self.description, "health": self.health_check(),
            "permission": "hanya membaca sumber publik; tidak login, tidak memposting (ADR-CRW-0004)",
            "proxy": konfig.proxy_tersamar(),
            "patuhi_robots": konfig.PATUHI_ROBOTS,
            "stealth": konfig.STEALTH,
            "supported_features": [TIPE_MISI],
            "katalog": [s.katalog(aktif=s.id not in nonaktif) for s in self.registri.values()],
            "ukuran_gudang_byte": self.gudang.ukuran_byte() if self.gudang else None,
        }

    def configure(self, nyalakan: list[str] = (), matikan: list[str] = ()) -> dict:
        tidak_dikenal = [s for s in (*nyalakan, *matikan) if s not in self.registri]
        if tidak_dikenal:
            raise MisiTidakValid(f"sumber tidak dikenal: {', '.join(tidak_dikenal)}")
        data = konfig.baca_konfigurasi()
        nonaktif = (set(data.get("nonaktif", [])) | set(matikan)) - set(nyalakan)
        data["nonaktif"] = sorted(nonaktif)
        konfig.simpan_konfigurasi(data)
        return data

    def execute(self, masukan: dict) -> dict:
        """Masukan {type, context, payload, trace_id} -> keluaran {result, confidence, source, trace_id}."""
        tipe = masukan.get("type", TIPE_MISI)
        if tipe != TIPE_MISI:
            return self.normalize({"status": "gagal", "alasan": f"tipe '{tipe}' belum didukung"}, 0.0,
                                  masukan.get("trace_id", ""))
        misi = Misi.dari_input(masukan)
        return self.jalankan(misi)

    def jalankan(self, misi: Misi) -> dict:
        dispatcher = Dispatcher(self.gudang, self.registri, konfig.baca_konfigurasi().get("nonaktif", []))
        ringkasan = dispatcher.jalankan(misi)
        return self.normalize(ringkasan, ringkasan.pop("confidence"), misi.trace_id)

    def normalize(self, result: dict, confidence: float, trace_id: str) -> dict:
        return {"result": result, "confidence": confidence, "source": f"{self.name}@{self.version}",
                "trace_id": trace_id}
