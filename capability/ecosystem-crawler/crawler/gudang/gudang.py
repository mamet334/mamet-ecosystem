"""Gudang data mentah lokal: SQLite + payload asli di data/mentah/ (ADR-CRW-0002)."""

import hashlib
import json
import sqlite3
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from crawler.inti.model import Misi, Temuan
from crawler.inti.teks import kata_kunci_cocok, sekarang_iso, ulid

from .pseudonim import pseudonim

SKEMA = """
CREATE TABLE IF NOT EXISTS misi (
    id TEXT PRIMARY KEY, trace_id TEXT, type TEXT, dibuat TEXT, selesai TEXT,
    status TEXT, spesifikasi TEXT, ringkasan TEXT
);
CREATE TABLE IF NOT EXISTS tangkapan (
    id TEXT PRIMARY KEY, kunci TEXT NOT NULL, revisi INTEGER NOT NULL, misi_pertama TEXT, trace_id TEXT,
    sumber TEXT, kanal TEXT, jenis_akses TEXT, jenis TEXT, id_asli TEXT, url TEXT, url_induk TEXT, parent_id TEXT,
    judul TEXT, teks TEXT, bahasa TEXT, penulis TEXT, penulis_hash TEXT, waktu_terbit TEXT, waktu_ambil TEXT,
    metrik TEXT, confidence REAL, hash_isi TEXT, path_mentah TEXT,
    status_knowledge TEXT NOT NULL DEFAULT 'hypothesis',
    UNIQUE (kunci, revisi)
);
CREATE TABLE IF NOT EXISTS misi_tangkapan (
    urut INTEGER PRIMARY KEY AUTOINCREMENT, misi_id TEXT NOT NULL, tangkapan_id TEXT NOT NULL,
    status TEXT, kata_kunci_cocok TEXT, UNIQUE (misi_id, tangkapan_id)
);
CREATE TABLE IF NOT EXISTS peristiwa (
    id INTEGER PRIMARY KEY AUTOINCREMENT, waktu TEXT, trace_id TEXT, misi_id TEXT,
    nama TEXT, sumber TEXT, detail TEXT
);
CREATE INDEX IF NOT EXISTS ix_tangkapan_kunci ON tangkapan (kunci, revisi);
CREATE INDEX IF NOT EXISTS ix_misi_tangkapan ON misi_tangkapan (misi_id, urut);
"""

# Kolom yang dikeluarkan lewat baca()/ekspor. Kolom `penulis` (username asli) sengaja tidak termasuk.
KOLOM_PUBLIK = (
    "id", "sumber", "kanal", "jenis_akses", "jenis", "id_asli", "url", "url_induk", "parent_id", "judul", "teks",
    "bahasa", "penulis_hash", "waktu_terbit", "waktu_ambil", "metrik", "confidence", "hash_isi", "revisi",
    "status_knowledge",
)


def url_kanonis(url: str) -> str:
    """Buang fragmen dan parameter pelacak agar URL yang sama dikenali sama."""
    s = urlsplit(url.strip())
    query = [(k, v) for k, v in parse_qsl(s.query) if not k.lower().startswith(("utm_", "fbclid", "gclid"))]
    return urlunsplit((s.scheme.lower(), s.netloc.lower(), s.path.rstrip("/") or "/", urlencode(query), ""))


class Gudang:
    def __init__(self, data_dir: Path, garam: str):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.garam = garam
        self.db = sqlite3.connect(self.data_dir / "gudang.db")
        self.db.row_factory = sqlite3.Row
        # WAL + synchronous NORMAL: commit per item tetap aman tetapi tidak menunggu fsync penuh setiap kali.
        self.db.execute("PRAGMA journal_mode = WAL")
        self.db.execute("PRAGMA synchronous = NORMAL")
        self.db.executescript(SKEMA)

    def tutup(self) -> None:
        self.db.close()

    def ukuran_byte(self) -> int:
        return sum(p.stat().st_size for p in self.data_dir.rglob("*") if p.is_file())

    # ---- misi -------------------------------------------------------------------------------------------------

    def catat_misi(self, misi: Misi, status: str, ringkasan: dict | None = None) -> None:
        selesai = sekarang_iso() if status not in ("antri", "berjalan") else None
        self.db.execute(
            "INSERT INTO misi (id, trace_id, type, dibuat, selesai, status, spesifikasi, ringkasan) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?) "
            "ON CONFLICT (id) DO UPDATE SET status = excluded.status, selesai = excluded.selesai, "
            "ringkasan = excluded.ringkasan",
            (misi.id, misi.trace_id, misi.type, sekarang_iso(), selesai, status,
             json.dumps(misi.ke_input(), ensure_ascii=False), json.dumps(ringkasan or {}, ensure_ascii=False)),
        )
        self.db.commit()

    def misi(self, misi_id: str) -> dict | None:
        row = self.db.execute("SELECT * FROM misi WHERE id = ?", (misi_id,)).fetchone()
        if not row:
            return None
        d = dict(row)
        d["spesifikasi"], d["ringkasan"] = json.loads(d["spesifikasi"]), json.loads(d["ringkasan"] or "{}")
        return d

    def daftar_misi(self, batas: int = 20) -> list[dict]:
        rows = self.db.execute("SELECT id, dibuat, status, spesifikasi FROM misi ORDER BY id DESC LIMIT ?", (batas,))
        return [{**dict(r), "spesifikasi": json.loads(r["spesifikasi"])} for r in rows]

    # ---- tangkapan --------------------------------------------------------------------------------------------

    def simpan(self, misi: Misi, sumber: str, kanal: str, jenis_akses: str, confidence: float, t: Temuan,
               pseudonim_penulis: bool = True) -> str:
        """Simpan satu Temuan. Status: 'baru', 'revisi', 'sama', atau 'ulang' (sudah tercatat di misi ini).
        pseudonim_penulis=False: simpan nama penulis asli di kolom penulis_hash (byline publik, ADR-CRW-0010)."""
        kunci = f"{sumber}:{t.id_asli}" if t.id_asli else f"{sumber}:url:{url_kanonis(t.url)}"
        hash_isi = hashlib.sha256(f"{t.judul}\n{t.teks}".encode("utf-8")).hexdigest()
        lama = self.db.execute(
            "SELECT id, revisi, hash_isi FROM tangkapan WHERE kunci = ? ORDER BY revisi DESC LIMIT 1", (kunci,)
        ).fetchone()

        if lama and lama["hash_isi"] == hash_isi:
            tangkapan_id, status = lama["id"], "sama"
            # Isi tidak berubah; metrik (suka, balasan) diperbarui ke angka terbaru.
            self.db.execute("UPDATE tangkapan SET metrik = ? WHERE id = ?",
                            (json.dumps(t.metrik, ensure_ascii=False), tangkapan_id))
        else:
            tangkapan_id, status = ulid(), ("revisi" if lama else "baru")
            parent_id = None
            if t.id_asli_induk:
                induk = self.db.execute(
                    "SELECT id FROM tangkapan WHERE kunci = ? ORDER BY revisi DESC LIMIT 1",
                    (f"{sumber}:{t.id_asli_induk}",),
                ).fetchone()
                parent_id = induk["id"] if induk else None
            waktu_ambil = sekarang_iso()
            self.db.execute(
                "INSERT INTO tangkapan (id, kunci, revisi, misi_pertama, trace_id, sumber, kanal, jenis_akses, jenis, "
                "id_asli, url, url_induk, parent_id, judul, teks, bahasa, penulis, penulis_hash, waktu_terbit, "
                "waktu_ambil, metrik, confidence, hash_isi, path_mentah) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (tangkapan_id, kunci, (lama["revisi"] + 1) if lama else 1, misi.id, misi.trace_id, sumber, kanal,
                 jenis_akses, t.jenis, t.id_asli, t.url, t.url_induk, parent_id, t.judul, t.teks, t.bahasa,
                 t.penulis or None,
                 (pseudonim(self.garam, sumber, t.penulis) if pseudonim_penulis else (t.penulis or None)),
                 t.waktu_terbit, waktu_ambil,
                 json.dumps(t.metrik, ensure_ascii=False), confidence, hash_isi,
                 self._tulis_mentah(sumber, tangkapan_id, waktu_ambil, t.mentah)),
            )

        tercatat = self.db.execute(
            "INSERT OR IGNORE INTO misi_tangkapan (misi_id, tangkapan_id, status, kata_kunci_cocok) "
            "VALUES (?, ?, ?, ?)",
            (misi.id, tangkapan_id, status,
             json.dumps(kata_kunci_cocok(f"{t.judul} {t.teks}", misi.kata_kunci), ensure_ascii=False)),
        ).rowcount
        self.db.commit()
        return status if tercatat else "ulang"

    def _tulis_mentah(self, sumber: str, tangkapan_id: str, waktu_ambil: str, mentah) -> str | None:
        if mentah is None:
            return None
        folder = self.data_dir / "mentah" / sumber / waktu_ambil[:10]
        folder.mkdir(parents=True, exist_ok=True)
        if isinstance(mentah, str):
            path = folder / f"{tangkapan_id}.html"
            path.write_text(mentah, encoding="utf-8")
        else:
            path = folder / f"{tangkapan_id}.json"
            path.write_text(json.dumps(mentah, ensure_ascii=False, default=str, indent=1), encoding="utf-8")
        return path.relative_to(self.data_dir).as_posix()

    def baca(self, misi_id: str, kursor: int = 0, batas: int = 500,
             buka_identitas: bool = False) -> tuple[list[dict], int]:
        """Pembacaan berbasis kursor untuk konsumen (Mamet, ekspor). Kursor dipegang konsumen."""
        kolom = ", ".join(f"t.{k}" for k in KOLOM_PUBLIK)
        if buka_identitas:
            kolom += ", t.penulis"
        rows = self.db.execute(
            f"SELECT mt.urut, mt.status AS status_misi, mt.kata_kunci_cocok, {kolom} "
            "FROM misi_tangkapan mt JOIN tangkapan t ON t.id = mt.tangkapan_id "
            "WHERE mt.misi_id = ? AND mt.urut > ? ORDER BY mt.urut LIMIT ?",
            (misi_id, kursor, batas),
        ).fetchall()
        hasil = []
        for r in rows:
            d = dict(r)
            d["metrik"] = json.loads(d["metrik"] or "{}")
            d["kata_kunci_cocok"] = json.loads(d["kata_kunci_cocok"] or "[]")
            hasil.append(d)
        return hasil, (hasil[-1]["urut"] if hasil else kursor)

    def jumlah(self, misi_id: str) -> int:
        return self.db.execute("SELECT COUNT(*) FROM misi_tangkapan WHERE misi_id = ?", (misi_id,)).fetchone()[0]

    def kursor_akhir(self, misi_id: str) -> int:
        row = self.db.execute("SELECT MAX(urut) FROM misi_tangkapan WHERE misi_id = ?", (misi_id,)).fetchone()
        return row[0] or 0

    def baca_semua(self, misi_id: str, buka_identitas: bool = False) -> list[dict]:
        semua, kursor = [], 0
        while True:
            bagian, kursor = self.baca(misi_id, kursor, 1000, buka_identitas)
            if not bagian:
                return semua
            semua += bagian

    # ---- peristiwa (observabilitas) ---------------------------------------------------------------------------

    def catat_peristiwa(self, misi: Misi, nama: str, sumber: str = "", **detail) -> None:
        self.db.execute(
            "INSERT INTO peristiwa (waktu, trace_id, misi_id, nama, sumber, detail) VALUES (?, ?, ?, ?, ?, ?)",
            (sekarang_iso(), misi.trace_id, misi.id, nama, sumber, json.dumps(detail, ensure_ascii=False, default=str)),
        )
        self.db.commit()

    def peristiwa(self, misi_id: str) -> list[dict]:
        rows = self.db.execute("SELECT * FROM peristiwa WHERE misi_id = ? ORDER BY id", (misi_id,))
        return [{**dict(r), "detail": json.loads(r["detail"])} for r in rows]
