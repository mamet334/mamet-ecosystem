"""Dispatcher (Pengatur Misi): menjalankan Misi ke adapter sumber. Tanpa LLM, tanpa menafsirkan perintah
bebas (ADR-CRW-0003). Satu sumber gagal tidak menghentikan sumber lain."""

import logging
from datetime import date
from fnmatch import fnmatch

from crawler import konfig

from .kontrak import Sumber
from .model import Misi, MisiTidakValid, Temuan
from .teks import ada_kata

log = logging.getLogger(__name__)


class Dispatcher:
    def __init__(self, gudang, registri: dict[str, Sumber], nonaktif: list[str] | None = None):
        self.gudang = gudang
        self.registri = registri
        self.nonaktif = set(nonaktif or [])

    def jalankan(self, misi: Misi) -> dict:
        tidak_dikenal = [s for s in misi.sumber if s not in self.registri]
        if tidak_dikenal:
            raise MisiTidakValid(f"sumber tidak dikenal: {', '.join(tidak_dikenal)}. "
                                 f"Pilihan: {', '.join(self.registri)}")

        self.gudang.catat_misi(misi, "berjalan")
        per_sumber, total, confidences = {}, 0, []

        for nama in misi.sumber:
            hasil = {"diambil": 0, "baru": 0, "revisi": 0, "gagal": 0}
            per_sumber[nama] = hasil
            sumber = self.registri[nama]
            sisa = misi.batas_total - total
            if sisa <= 0:
                hasil["alasan"] = "batas total misi tercapai sebelum sumber ini dijalankan"
                continue
            if nama in self.nonaktif:
                hasil.update(gagal=1, alasan="sumber dinonaktifkan Owner")
                continue
            kesehatan = sumber.kesehatan()
            if not kesehatan.startswith("siap"):
                hasil.update(gagal=1, alasan=kesehatan)
                continue

            batas = min(misi.batas_per_sumber, sisa)

            def lapor(nama_peristiwa: str, _sumber=nama, **detail):
                log.info("%s [%s] %s", nama_peristiwa, _sumber, detail or "")
                self.gudang.catat_peristiwa(misi, nama_peristiwa, _sumber, **detail)

            lapor("Adapter.Request", batas=batas)
            kecualikan = misi.opsi(nama).get("kecualikan_penulis", list(sumber.kecualikan_penulis_default))
            try:
                for temuan in sumber.ambil(misi, batas, lapor):
                    if not self._lolos(misi, temuan, kecualikan):
                        continue
                    jenis_akses = temuan.jenis_akses or sumber.jenis_akses
                    confidence = konfig.CONFIDENCE_DASAR[jenis_akses]
                    status = self.gudang.simpan(misi, nama, sumber.kanal, jenis_akses, confidence, temuan,
                                                sumber.pseudonim_penulis)
                    if status == "ulang":
                        continue  # item yang sama muncul dua kali di misi ini (mis. dari dua kata kunci)
                    hasil["diambil"] += 1
                    hasil["baru"] += status == "baru"
                    hasil["revisi"] += status == "revisi"
                    confidences.append(confidence)
                    total += 1
                    if hasil["diambil"] >= batas:
                        break
                lapor("Adapter.Response", **hasil)
            except Exception as exc:  # adapter gagal tidak boleh menjatuhkan misi
                log.exception("Sumber '%s' gagal", nama)
                hasil.update(gagal=1, alasan=f"{type(exc).__name__}: {exc}")
                lapor("Adapter.Error", alasan=hasil["alasan"])

        gagal = sum(h["gagal"] for h in per_sumber.values())
        if not gagal:
            status = "selesai"
        elif gagal == len(per_sumber) or not total:
            status = "gagal"
        else:
            status = "selesai_sebagian"

        ringkasan = {
            "misi_id": misi.id, "status": status, "per_sumber": per_sumber, "total": total,
            "kursor": self.gudang.kursor_akhir(misi.id),
            # Rata-rata keandalan pengambilan item yang berhasil (ADR-CRW-0003 butir 6).
            "confidence": round(sum(confidences) / len(confidences), 3) if confidences else 0.0,
        }
        self.gudang.catat_misi(misi, status, ringkasan)
        return ringkasan

    @staticmethod
    def _lolos(misi: Misi, t: Temuan, kecualikan_penulis=None) -> bool:
        """Saringan mekanis: teks kosong, penulis yang dikecualikan (pola glob, mis. akun robot berita
        '*-poster.bsky.social'), kata kunci pengecualian, dan rentang waktu."""
        if not (t.teks or t.judul).strip():
            return False
        if kecualikan_penulis and t.penulis:
            pola = [kecualikan_penulis] if isinstance(kecualikan_penulis, str) else kecualikan_penulis
            if any(fnmatch(t.penulis.lower(), p.lower()) for p in pola):
                return False
        if misi.kata_kunci_kecuali and ada_kata(f"{t.judul} {t.teks}", misi.kata_kunci_kecuali):
            return False
        if t.waktu_terbit and (misi.dari or misi.sampai):
            try:
                hari = date.fromisoformat(t.waktu_terbit[:10])
            except ValueError:
                return True  # tanggal tidak terbaca: jangan dibuang
            if misi.dari and hari < date.fromisoformat(misi.dari):
                return False
            if misi.sampai and hari > date.fromisoformat(misi.sampai):
                return False
        return True
