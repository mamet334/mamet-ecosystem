"""Uji tanpa jaringan: Misi, Dispatcher, Gudang (dedup, revisi, utas, pseudonim), ekspor, inbox, helper CLI."""

import csv
import json
from datetime import date, timedelta

import pytest

from crawler.gudang import Gudang, pseudonim
from crawler.gudang.ekspor import ekspor
from crawler.inti import Misi, Sumber, Temuan
from crawler.inti.dispatcher import Dispatcher
from crawler.inti.model import MisiTidakValid
from crawler.sumber.inbox import Inbox
from crawler.wajah.cli import _opsi, _tanggal


class SumberPalsu(Sumber):
    id = "palsu"
    kanal = "laptop"
    jenis_akses = "api_resmi"

    def __init__(self, temuan=(), error=None):
        self.temuan, self.error = list(temuan), error

    def ambil(self, misi, batas, lapor):
        lapor("Sumber.HasilKataKunci", jumlah=len(self.temuan))
        yield from self.temuan
        if self.error:
            raise self.error


class SumberRusak(SumberPalsu):
    id = "rusak"


def t(id_asli, teks="keluhan mutasi ASN", **kw):
    return Temuan(jenis=kw.pop("jenis", "postingan"), id_asli=id_asli, teks=teks,
                  url=f"https://contoh.id/{id_asli}", penulis=kw.pop("penulis", "budi"), mentah={"id": id_asli}, **kw)


@pytest.fixture
def gudang(tmp_path):
    g = Gudang(tmp_path / "data", "garam-uji")
    yield g
    g.tutup()


def misi(**kw):
    return Misi(**{"sumber": ["palsu"], "kata_kunci": ["mutasi"], **kw})


def test_misi_dari_input_format_mamet():
    m = Misi.dari_input({
        "type": "crawler.misi.jalankan",
        "context": {"owner_intent": "cari keluhan", "bahasa": ["id"]},
        "payload": {"sumber": ["reddit"], "kata_kunci": ["mutasi ASN"], "batas": {"per_sumber": 5},
                    "opsi_sumber": {"reddit": {"subreddit": "indonesia"}}},
        "trace_id": "maef-1",
    })
    assert m.trace_id == "maef-1" and m.batas_per_sumber == 5 and m.opsi("reddit") == {"subreddit": "indonesia"}
    assert Misi.dari_input(m.ke_input()).ke_input() == m.ke_input()


def test_misi_tanpa_sumber_ditolak():
    with pytest.raises(MisiTidakValid):
        Misi.dari_input({"payload": {"sumber": "otomatis", "kata_kunci": ["x"]}})
    assert Misi(sumber=["a"]).trace_id.startswith("lokal-")


def test_dispatcher_dedup_revisi_dan_utas(gudang):
    induk = t("p1")
    anak = t("c1", teks="setuju, mutasi tanpa kabar", jenis="komentar", id_asli_induk="p1", penulis="ani")
    hasil = Dispatcher(gudang, {"palsu": SumberPalsu([induk, anak, t("p1")])}).jalankan(misi())
    assert hasil["status"] == "selesai"
    assert hasil["per_sumber"]["palsu"] == {"diambil": 2, "baru": 2, "revisi": 0, "gagal": 0}

    rows = gudang.baca_semua(hasil["misi_id"])
    assert rows[1]["parent_id"] == rows[0]["id"]
    assert all(r["status_knowledge"] == "hypothesis" for r in rows)
    assert "penulis" not in rows[0] and rows[0]["penulis_hash"] == pseudonim("garam-uji", "palsu", "budi")
    assert rows[0]["kata_kunci_cocok"] == ["mutasi"]

    # Misi kedua: p1 sama (bukan baru), c1 berubah isi (revisi baru, versi lama tetap ada).
    hasil2 = Dispatcher(gudang, {"palsu": SumberPalsu([t("p1"), t("c1", teks="mutasi diedit")])}).jalankan(misi())
    assert hasil2["per_sumber"]["palsu"] == {"diambil": 2, "baru": 0, "revisi": 1, "gagal": 0}
    revisi = gudang.db.execute("SELECT revisi FROM tangkapan WHERE kunci = 'palsu:c1' ORDER BY revisi").fetchall()
    assert [r[0] for r in revisi] == [1, 2]


def test_dispatcher_saringan_dan_batas(gudang):
    lama = (date.today() - timedelta(days=200)).isoformat()
    temuan = [t("a", waktu_terbit=lama), t("b", teks="mutasi lowongan"), t("c", teks=""), t("d"), t("e"), t("f")]
    m = misi(kata_kunci_kecuali=["lowongan"], dari=(date.today() - timedelta(days=30)).isoformat(),
             batas_per_sumber=2)
    hasil = Dispatcher(gudang, {"palsu": SumberPalsu(temuan)}).jalankan(m)
    assert [r["id_asli"] for r in gudang.baca_semua(hasil["misi_id"])] == ["d", "e"]


def test_satu_sumber_gagal_tidak_menghentikan_yang_lain(gudang):
    registri = {"palsu": SumberPalsu([t("a")]), "rusak": SumberRusak([t("x")], error=RuntimeError("403"))}
    hasil = Dispatcher(gudang, registri, nonaktif=[]).jalankan(misi(sumber=["rusak", "palsu"]))
    assert hasil["status"] == "selesai_sebagian"
    assert hasil["per_sumber"]["rusak"]["alasan"] == "RuntimeError: 403"
    assert hasil["per_sumber"]["palsu"]["diambil"] == 1
    nama = [p["nama"] for p in gudang.peristiwa(hasil["misi_id"])]
    assert "Adapter.Error" in nama and "Adapter.Response" in nama


def test_sumber_nonaktif_dan_tidak_dikenal(gudang):
    hasil = Dispatcher(gudang, {"palsu": SumberPalsu([t("a")])}, nonaktif=["palsu"]).jalankan(misi())
    assert hasil["status"] == "gagal" and "dinonaktifkan" in hasil["per_sumber"]["palsu"]["alasan"]
    with pytest.raises(MisiTidakValid):
        Dispatcher(gudang, {}).jalankan(misi())


def test_ekspor_pseudonim_default_dan_buka_identitas(gudang, tmp_path):
    for buka, harapan in ((False, pseudonim("garam-uji", "palsu", "budi")), (True, "budi")):
        hasil = Dispatcher(gudang, {"palsu": SumberPalsu([t("a")])}).jalankan(misi(buka_identitas_penulis=buka))
        paths = ekspor(gudang, hasil["misi_id"], ["csv", "jsonl", "md"], tmp_path / "hasil")
        with paths[0].open(encoding="utf-8-sig") as f:
            assert next(csv.DictReader(f))["penulis"] == harapan
        assert json.loads(paths[1].read_text(encoding="utf-8").splitlines()[0])["penulis"] == harapan
        assert "contoh.id/a" in paths[2].read_text(encoding="utf-8")


def test_inbox_txt_dan_saring_kata_kunci(tmp_path, gudang):
    (tmp_path / "x_asn.txt").write_text(
        "URL: https://x.com/a/1\nTanggal: 2026-10-20\nMutasi tanpa kabar\n---\nResep sambal enak\n", encoding="utf-8")
    (tmp_path / "_CARA_PAKAI.txt").write_text("mutasi diabaikan", encoding="utf-8")
    hasil = Dispatcher(gudang, {"inbox": Inbox(tmp_path)}).jalankan(misi(sumber=["inbox"]))
    rows = gudang.baca_semua(hasil["misi_id"])
    assert len(rows) == 1 and rows[0]["metrik"]["platform"] == "Twitter/X"
    assert rows[0]["waktu_terbit"] == "2026-10-20" and rows[0]["confidence"] == 0.5


def test_mcp_server_mendaftarkan_tool_dan_meringkas():
    import asyncio

    from crawler.wajah.mcp_server import _ringkas, server

    nama = {t.name for t in asyncio.run(server.list_tools())}
    assert nama == {"katalog", "jalankan_misi", "status_misi", "daftar_misi", "baca_tangkapan", "ekspor_misi"}
    r = _ringkas({"id": "1", "sumber": "s", "jenis": "postingan", "judul": "", "teks": "a" * 10, "url": "u",
                  "waktu_terbit": "", "penulis_hash": "p_x", "metrik": {"suka": 0, "balas": 2}, "parent_id": None,
                  "kata_kunci_cocok": []}, 4)
    assert r["teks"] == "aaaa…" and r["penulis"] == "p_x" and r["metrik"] == {"balas": 2}


def test_helper_cli():
    assert _tanggal("7h") == (date.today() - timedelta(days=7)).isoformat()
    assert _tanggal("2026-01-02") == "2026-01-02"
    assert _opsi(["reddit.subreddit=indonesia", "playstore.aplikasi=a,b", "reddit.maks_utas_komentar=3"]) == {
        "reddit": {"subreddit": "indonesia", "maks_utas_komentar": 3}, "playstore": {"aplikasi": ["a", "b"]}}
    with pytest.raises(MisiTidakValid):
        _opsi(["tanpa_titik=1"])
