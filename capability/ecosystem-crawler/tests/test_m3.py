"""Uji tanpa jaringan untuk M3 dan ADR-CRW-0009: saringan penulis, YouTube API, Kaskus, web, RSS media,
Media Konsumen, Arctic Shift, dan deteksi blokir."""

import json

import pytest

from crawler.gudang import Gudang
from crawler.inti import Misi, Sumber, Temuan
from crawler.inti.dispatcher import Dispatcher
from crawler.kanal.web import _terblokir
from crawler.sumber import arctic_shift as arctic_mod
from crawler.sumber import kaskus as kaskus_mod
from crawler.sumber import mediakonsumen as mk_mod
from crawler.sumber import rss_media as rss_mod
from crawler.sumber import web as web_mod
from crawler.sumber import youtube as yt_mod
from crawler.sumber.mediakonsumen import slug


@pytest.fixture
def gudang(tmp_path):
    g = Gudang(tmp_path / "data", "garam-uji")
    yield g
    g.tutup()


def diam(*_a, **_k):
    pass


class SumberPenulis(Sumber):
    id = "palsu"
    kanal = "hp"
    jenis_akses = "api_resmi"

    def ambil(self, misi, batas, lapor):
        for i, penulis in enumerate(("katadata-poster.bsky.social", "warga.bsky.social")):
            yield Temuan(jenis="postingan", id_asli=str(i), teks="cari cuan", url=f"https://x/{i}", penulis=penulis)


def test_kecualikan_penulis_pola_glob(gudang):
    m = Misi(sumber=["palsu"], kata_kunci=["cuan"],
             opsi_sumber={"palsu": {"kecualikan_penulis": ["*-poster.bsky.social"]}})
    hasil = Dispatcher(gudang, {"palsu": SumberPenulis()}).jalankan(m)
    assert hasil["per_sumber"]["palsu"]["diambil"] == 1


class Respon:
    def __init__(self, data):
        self.data = data

    def json(self):
        return self.data

    @property
    def content(self):  # untuk sumber yang memakai feedparser (arxiv, rss)
        return self.data


class SesiPalsu:
    """Pengganti SesiSopan: jawaban berdasarkan potongan URL."""

    def __init__(self, jawaban):
        self.jawaban, self.dipanggil = jawaban, []

    def __call__(self, *_a, **_k):
        return self

    def get(self, url, params=None):
        self.dipanggil.append((url, params))
        return Respon(next(v for k, v in self.jawaban.items() if url.endswith(k)))


def test_youtube_api_video_komentar_dan_balasan(monkeypatch):
    monkeypatch.setattr(yt_mod.konfig, "YOUTUBE_API_KEY", "kunci-uji")
    komentar = lambda i, teks: {"id": i, "snippet": {"textOriginal": teks, "authorDisplayName": "@a",
                                                     "publishedAt": "2026-10-01T00:00:00Z", "likeCount": 3}}
    sesi = SesiPalsu({
        "/search": {"items": [{"id": {"videoId": "v1"}}]},
        "/videos": {"items": [{"id": "v1", "snippet": {"title": "Keluhan BPJS", "description": "isi",
                                                        "channelTitle": "Kompas", "publishedAt": "2026-02-06T00:00:00Z"},
                               "statistics": {"viewCount": "10", "commentCount": "2"}}]},
        "/commentThreads": {"items": [{"id": "t1", "snippet": {"topLevelComment": komentar("c1", "antri 8 jam")},
                                       "replies": {"comments": [komentar("c1.r1", "sama")]}}]},
    })
    monkeypatch.setattr(yt_mod, "SesiSopan", sesi)
    m = Misi(sumber=["youtube"], kata_kunci=["keluhan BPJS"], ambil_komentar=True, kedalaman_komentar=2,
             url_awal=["https://youtu.be/v1"])
    video, akar, balasan = list(yt_mod.YouTube().ambil(m, 50, diam))
    assert video.id_asli == "video:v1" and video.metrik["tayang"] == 10
    assert akar.id_asli_induk == "video:v1" and balasan.id_asli_induk == "komentar:t1"
    assert all(p.get("key") == "kunci-uji" for _, p in sesi.dipanggil)
    assert yt_mod._id_video("https://www.youtube.com/shorts/sh0rt") == "sh0rt"


def test_youtube_tanpa_kunci_pakai_ytdlp(monkeypatch):
    # Tanpa kunci API, sumber tetap siap lewat yt-dlp (ADR-CRW-0010).
    monkeypatch.setattr(yt_mod.konfig, "YOUTUBE_API_KEY", "")
    assert "yt-dlp" in yt_mod.YouTube().kesehatan()
    info = {"id": "v9", "title": "Keluhan", "description": "isi", "channel": "Kanal", "upload_date": "20261001",
            "view_count": 5, "comments": [{"id": "c1", "parent": "root", "text": "antri", "author": "@a",
                                           "timestamp": 1790000000}]}
    video, komentar = list(yt_mod._dari_info_ytdlp(info))
    assert video.waktu_terbit == "2026-10-01" and video.penulis == "Kanal"
    assert komentar.id_asli_induk == "video:v9" and komentar.metrik["waktu_perkiraan"] is True


class AksesPalsu:
    def __init__(self, halaman):
        self.halaman = halaman

    def __call__(self, *_a, **_k):
        return self

    def ambil(self, url, lapor=None):
        return self.halaman[url], 1, url


def test_kaskus_dari_next_data(monkeypatch, gudang):
    thread = {"id": "5adad9", "title": "Usaha Sampingan", "dateline": 1524291924,
              "first_post": {"content": {"text": "Ane jualan HP bekas"}}, "thread_starter": {"username": "agan"},
              "meta": {"total_views": 16014, "total_replies": 118}, "community": {"name": "The Lounge"}}
    data = {"props": {"pageProps": {"fallback": {'#url:"/threads/5adad9/x",': {"data": thread}}}}}
    url = "https://www.kaskus.co.id/thread/5adad9/usaha-sampingan"
    html = f'<html><script id="__NEXT_DATA__" type="application/json">{json.dumps(data)}</script></html>'
    monkeypatch.setattr(kaskus_mod, "AksesWeb", AksesPalsu({url: html}))
    m = Misi(sumber=["kaskus"], url_awal=["https://m.kaskus.co.id/thread/5adad9/usaha-sampingan/4",
                                          "https://contoh.com/bukan-kaskus"])
    hasil = Dispatcher(gudang, {"kaskus": kaskus_mod.Kaskus()}).jalankan(m)
    [r] = gudang.baca_semua(hasil["misi_id"])
    assert r["url"] == url and r["teks"] == "Ane jualan HP bekas" and r["metrik"]["balasan"] == 118
    with pytest.raises(ValueError):
        list(kaskus_mod.Kaskus().ambil(Misi(sumber=["kaskus"]), 5, diam))


ARTIKEL = ("<html><head><title>Antrean Puskesmas</title></head><body><article><p>"
           + "Warga mengeluhkan antrean panjang di puskesmas setiap pagi. " * 12 + "</p></article></body></html>")


def test_web_ekstrak_dan_serahkan_link_kaskus(monkeypatch, gudang):
    url = "https://berita.contoh.id/a"
    monkeypatch.setattr(web_mod, "AksesWeb", AksesPalsu({url: ARTIKEL}))
    m = Misi(sumber=["web", "kaskus"], url_awal=[url, "https://www.kaskus.co.id/thread/1/x"])
    hasil = Dispatcher(gudang, {"web": web_mod.Web()}).jalankan(Misi(sumber=["web"], url_awal=m.url_awal[:1]))
    [r] = gudang.baca_semua(hasil["misi_id"])
    assert "antrean panjang" in r["teks"] and r["jenis"] == "dokumen"
    assert [t.url for t in web_mod.Web().ambil(m, 10, diam)] == [url]  # link Kaskus diserahkan ke sumber kaskus


def _rss(*judul):
    items = "".join(f"<item><title>{j}</title><link>https://media.id/{i}</link><guid>g{i}</guid>"
                    f"<description>ringkasan {j}</description></item>" for i, j in enumerate(judul))
    return f'<?xml version="1.0"?><rss version="2.0"><channel><title>x</title>{items}</channel></rss>'


def test_rss_media_saring_kata_kunci_dan_ambil_isi(monkeypatch):
    halaman = {rss_mod.FEED["detik"]: _rss("Antrean BPJS mengular", "Harga cabai naik"),
               "https://media.id/0": ARTIKEL}
    monkeypatch.setattr(rss_mod, "AksesWeb", AksesPalsu(halaman))
    m = Misi(sumber=["rss_media"], kata_kunci=["BPJS"],
             opsi_sumber={"rss_media": {"media": ["detik"], "ambil_isi": True}})
    [t] = list(rss_mod.RssMedia().ambil(m, 10, diam))
    assert t.judul == "Antrean BPJS mengular" and "antrean panjang" in t.teks and t.jenis_akses == "html"


def test_mediakonsumen_tag_dari_kata_kunci(monkeypatch):
    assert slug("BPJS Kesehatan") == "bpjs-kesehatan"
    url = "https://mediakonsumen.com/tag/bpjs-kesehatan/feed"
    monkeypatch.setattr(mk_mod, "AksesWeb", AksesPalsu({url: _rss("Sulit dapat kuota berobat")}))
    m = Misi(sumber=["mediakonsumen"], kata_kunci=["BPJS Kesehatan"],
             opsi_sumber={"mediakonsumen": {"halaman": 1, "ambil_isi": False}})
    [t] = list(mk_mod.MediaKonsumen().ambil(m, 10, diam))
    assert t.judul == "Sulit dapat kuota berobat" and t.metrik["jalur"] == "tag/bpjs-kesehatan"


def test_mediakonsumen_cadangan_feed_utama_bila_tag_tidak_ada(monkeypatch):
    # Tag "harga-beras" tidak ada (KeyError di AksesPalsu = 404); feed utama halaman 1 berisi dua surat.
    halaman = {"https://mediakonsumen.com/feed": _rss("Harga beras di minimarket naik", "Paket telat datang")}
    monkeypatch.setattr(mk_mod, "AksesWeb", AksesPalsu(halaman))
    m = Misi(sumber=["mediakonsumen"], kata_kunci=["harga beras"],
             opsi_sumber={"mediakonsumen": {"halaman_cadangan": 1, "ambil_isi": False}})
    peristiwa = []
    [t] = list(mk_mod.MediaKonsumen().ambil(m, 10, lambda nama, **d: peristiwa.append(nama)))
    assert t.judul == "Harga beras di minimarket naik" and t.metrik["jalur"] == "feed_utama"
    assert "Adapter.FallbackTriggered" in peristiwa


class BlueskyPalsu(SumberPenulis):
    id = "bluesky"
    kecualikan_penulis_default = ("*-poster.bsky.social",)


def test_bluesky_buang_robot_berita_default_dan_bisa_dimatikan(gudang):
    registri = {"bluesky": BlueskyPalsu()}
    hasil = Dispatcher(gudang, registri).jalankan(Misi(sumber=["bluesky"], kata_kunci=["cuan"]))
    assert hasil["per_sumber"]["bluesky"]["diambil"] == 1
    m = Misi(sumber=["bluesky"], kata_kunci=["cuan"], opsi_sumber={"bluesky": {"kecualikan_penulis": []}})
    assert Dispatcher(gudang, registri).jalankan(m)["per_sumber"]["bluesky"]["diambil"] == 2


def test_arctic_shift_postingan_dan_pohon_komentar(monkeypatch):
    post = {"id": "p1", "title": "BPJS ribet", "selftext": "antri lama", "permalink": "/r/indonesia/comments/p1/x/",
            "author": "a", "created_utc": 1792571307, "score": 5, "num_comments": 2}
    balas = {"kind": "t1", "data": {"id": "c2", "parent_id": "t1_c1", "author": "c", "body": "setuju",
                                    "created_utc": 1792571400, "score": 1}}
    pohon = {"data": [
        {"kind": "t1", "data": {"id": "c0", "author": "AutoModerator", "body": "aturan"}},
        {"kind": "t1", "data": {"id": "c1", "parent_id": "t3_p1", "author": "b", "body": "sama", "score": 2,
                                "created_utc": 1792571350, "replies": {"data": {"children": [balas]}}}}]}
    monkeypatch.setattr(arctic_mod, "SesiSopan", SesiPalsu({"/posts/search": {"data": [post]},
                                                            "/comments/tree": pohon}))
    m = Misi(sumber=["arctic_shift"], kata_kunci=["BPJS"], ambil_komentar=True, kedalaman_komentar=2)
    hasil = list(arctic_mod.ArcticShift().ambil(m, 10, diam))
    assert [t.id_asli for t in hasil] == ["t3_p1", "t1_c1", "t1_c2"]  # AutoModerator dibuang
    assert hasil[2].id_asli_induk == "t1_c1"


def test_proxy_dari_konfig_dan_penyamaran(monkeypatch):
    from crawler import konfig
    from crawler.kanal import AksesWeb, SesiSopan

    assert konfig.proxies("") is None  # "" = paksa langsung
    assert konfig.proxies("http://host:8080") == {"http": "http://host:8080", "https": "http://host:8080"}
    assert konfig.proxy_tersamar("http://budi:rahasia@host:8080") == "http://budi:***@host:8080"
    assert "tidak ada" in konfig.proxy_tersamar("")

    monkeypatch.setattr(konfig, "PROXY", "http://proxy.lokal:3128")
    assert SesiSopan("ua").session.proxies["https"] == "http://proxy.lokal:3128"      # ikut .env
    assert AksesWeb("ua").proxies["http"] == "http://proxy.lokal:3128"
    assert AksesWeb("ua", proxy="").proxies is None                                   # override ke langsung


def test_pseudonim_dimatikan_untuk_sumber_rujukan(gudang):
    from crawler.gudang import pseudonim

    class Rujukan(SumberPenulis):
        id = "openalex"
        pseudonim_penulis = False

    class Sosial(SumberPenulis):
        id = "bluesky"

    reg = {"openalex": Rujukan(), "bluesky": Sosial()}
    hasil = Dispatcher(gudang, reg).jalankan(Misi(sumber=["openalex", "bluesky"], kata_kunci=["cuan"],
                                                  opsi_sumber={"bluesky": {"kecualikan_penulis": []}}))
    rows = gudang.baca_semua(hasil["misi_id"])
    oa = [r["penulis_hash"] for r in rows if r["sumber"] == "openalex"]
    bs = [r["penulis_hash"] for r in rows if r["sumber"] == "bluesky"]
    assert oa and all(not p.startswith("p_") for p in oa)                           # nama asli (byline)
    assert bs and all(p.startswith("p_") for p in bs)                               # pseudonim
    assert pseudonim("garam-uji", "bluesky", "warga.bsky.social") in bs


def test_openalex_susun_abstrak_dan_metadata(monkeypatch):
    from crawler.sumber import openalex as oa

    assert oa._abstrak({"Mekanika": [0], "kuantum": [1], "itu": [2]}) == "Mekanika kuantum itu"
    assert oa._abstrak(None) == ""
    work = {"id": "https://openalex.org/W1", "title": "Pengantar Fisika Kuantum", "publication_date": "2014-01-01",
            "language": "id", "cited_by_count": 8, "type": "book",
            "abstract_inverted_index": {"Buku": [0], "fisika": [1]},
            "primary_location": {"landing_page_url": "https://contoh.id/w1", "source": {"display_name": "Unsyiah"}},
            "authorships": [{"author": {"display_name": "Budi"}}]}
    monkeypatch.setattr(oa, "SesiSopan", SesiPalsu({"openalex.org/works": {"results": [work], "meta": {"count": 1}}}))
    m = Misi(sumber=["openalex"], kata_kunci=["fisika kuantum"])
    [t] = list(oa.OpenAlex().ambil(m, 10, diam))
    assert t.teks == "Buku fisika" and t.penulis == "Budi" and t.metrik["sitasi"] == 8
    assert t.url == "https://contoh.id/w1" and t.jenis == "dokumen"


def test_wikipedia_cari_lalu_ringkas(monkeypatch):
    from crawler.sumber import wikipedia as wp

    jawaban = {
        "/w/api.php": {"query": {"search": [{"title": "Mekanika kuantum", "pageid": 3855}]}},
        "Mekanika_kuantum": {"type": "standard", "title": "Mekanika kuantum", "pageid": 3855,
                             "extract": "Mekanika kuantum adalah cabang fisika.", "timestamp": "2026-01-01T00:00:00Z",
                             "description": "cabang fisika", "content_urls": {"desktop": {"page": "https://id.wikipedia.org/wiki/Mekanika_kuantum"}}},
    }
    monkeypatch.setattr(wp, "SesiSopan", SesiPalsu(jawaban))
    m = Misi(sumber=["wikipedia"], kata_kunci=["mekanika kuantum"])
    [t] = list(wp.Wikipedia().ambil(m, 10, diam))
    assert t.judul == "Mekanika kuantum" and "cabang fisika" in t.teks
    assert t.url.endswith("/Mekanika_kuantum") and t.id_asli == "wiki:id:3855"


def test_arxiv_parse_feed(monkeypatch):
    from crawler.sumber import arxiv as ax

    atom = ('<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom" '
            'xmlns:arxiv="http://arxiv.org/schemas/atom"><entry>'
            '<id>http://arxiv.org/abs/2504.20145v2</id><title>Roadmap on Quantum Thermodynamics</title>'
            '<summary>Ringkasan abstrak preprint.</summary><published>2025-04-28T18:00:06Z</published>'
            '<author><name>Steve Campbell</name></author><author><name>Irene D Amico</name></author>'
            '<link title="pdf" href="http://arxiv.org/pdf/2504.20145v2" type="application/pdf"/>'
            '<category term="quant-ph"/><arxiv:primary_category term="quant-ph"/></entry></feed>')
    monkeypatch.setattr(ax, "SesiSopan", SesiPalsu({"api/query": atom}))
    m = Misi(sumber=["arxiv"], kata_kunci=["quantum thermodynamics"])
    [t] = list(ax.Arxiv().ambil(m, 10, diam))
    assert t.judul.startswith("Roadmap") and "abstrak" in t.teks and t.penulis == "Steve Campbell; Irene D Amico"
    assert t.metrik["kategori_utama"] == "quant-ph" and t.jenis == "dokumen"


def test_stackexchange_pertanyaan_dengan_body(monkeypatch):
    from crawler.sumber import stackexchange as se

    jawaban = {"items": [{"question_id": 42, "title": "Offline note app", "link": "https://softwarerecs.se/q/42",
                          "body": "<p>Butuh aplikasi catatan offline</p>", "creation_date": 1600000000, "score": 5,
                          "answer_count": 3, "view_count": 100, "is_answered": True, "tags": ["notes"],
                          "owner": {"display_name": "user3257"}}], "quota_remaining": 299}
    monkeypatch.setattr(se, "SesiSopan", SesiPalsu({"search/advanced": jawaban}))
    m = Misi(sumber=["stackexchange"], kata_kunci=["offline note app"],
             opsi_sumber={"stackexchange": {"site": "softwarerecs"}})
    [t] = list(se.StackExchange().ambil(m, 10, diam))
    assert t.id_asli == "softwarerecs:42" and "offline" in t.teks and t.metrik["skor"] == 5
    assert t.penulis == "user3257"


def test_turnbackhoax_label_dan_saring(monkeypatch):
    from crawler.sumber import turnbackhoax as tbh

    feed = ('<?xml version="1.0"?><rss version="2.0"><channel><title>x</title>'
            '<item><title>[SALAH] MBG Berhenti Sementara</title><link>https://turnbackhoax.id/a</link>'
            '<guid>g1</guid><description>klaim MBG salah</description></item>'
            '<item><title>[PENIPUAN] Lowongan palsu</title><link>https://turnbackhoax.id/b</link>'
            '<guid>g2</guid><description>soal lowongan</description></item></channel></rss>')
    monkeypatch.setattr(tbh, "AksesWeb", AksesPalsu({"https://turnbackhoax.id/feed": feed}))
    m = Misi(sumber=["turnbackhoax"], kata_kunci=["MBG"],
             opsi_sumber={"turnbackhoax": {"halaman": 1, "ambil_isi": False}})
    [t] = list(tbh.TurnBackHoax().ambil(m, 10, diam))
    assert t.metrik["label"] == "SALAH" and "MBG" in t.judul and t.jenis == "dokumen"


def test_deteksi_halaman_blokir():
    assert _terblokir(403, "")
    assert _terblokir(200, "<title>Just a moment...</title>")
    assert not _terblokir(200, "<p>artikel biasa yang memuat kata captcha di formulir komentar</p>")
