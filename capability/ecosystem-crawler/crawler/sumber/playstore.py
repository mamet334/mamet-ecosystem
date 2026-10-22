"""Kanal hp: ulasan Google Play Store lewat google-play-scraper.

Diaktifkan lagi di ADR-CRW-0010. Aplikasi target dari opsi_sumber.playstore.aplikasi; bila kosong, aplikasi dicari
dengan kata kunci misi (pencarian Play Store biasa, bukan penilaian relevansi)."""

from collections.abc import Iterator

from google_play_scraper import Sort, app, reviews, search
from google_play_scraper.exceptions import NotFoundError

from crawler.inti import Misi, Pelapor, Sumber, Temuan
from crawler.inti.teks import bersihkan, ke_iso, sebagai_daftar


class PlayStore(Sumber):
    id = "playstore"
    kanal = "hp"
    jenis_akses = "intercept_json"
    kemampuan = ("cari", "ulasan")
    bahasa = ("semua",)
    cocok_untuk = ("ulasan_aplikasi", "keluhan", "riset_produk")
    batas_laju = "ditangani pustaka; hindari ribuan ulasan per menit"
    alat = ({"nama": "google-play-scraper", "repo": "github.com/JoMingyu/google-play-scraper", "lisensi": "MIT"},)

    def ambil(self, misi: Misi, batas: int, lapor: Pelapor) -> Iterator[Temuan]:
        opsi = misi.opsi(self.id)
        lang = opsi.get("lang", misi.bahasa[0] if misi.bahasa else "id")
        country = opsi.get("country", (misi.wilayah or "ID").lower())
        aplikasi = list(sebagai_daftar(opsi.get("aplikasi")))
        if not aplikasi:
            if not misi.kata_kunci:
                raise ValueError("playstore butuh opsi_sumber.playstore.aplikasi atau kata_kunci")
            n = int(opsi.get("cari_aplikasi", 3))
            for kw in misi.kata_kunci:
                hits = search(kw, lang=lang, country=country, n_hits=n)
                tanpa_id = [h.get("title") for h in hits if not h.get("appId")]
                if tanpa_id:
                    lapor("Sumber.HasilTanpaId", kata_kunci=kw, judul=tanpa_id)
                aplikasi += [h["appId"] for h in hits if h.get("appId")]
            aplikasi = list(dict.fromkeys(aplikasi))
            lapor("Sumber.AplikasiDipilih", aplikasi=aplikasi, dari_kata_kunci=misi.kata_kunci)

        bintang = sebagai_daftar(opsi.get("bintang")) or [None]  # None = semua bintang
        per_putaran = max(1, batas // (len(aplikasi) * len(bintang) or 1))
        for app_id in aplikasi:
            try:
                judul_app = app(app_id, lang=lang, country=country)["title"]
            except NotFoundError:
                lapor("Sumber.AplikasiTidakDitemukan", aplikasi=app_id)
                continue
            for skor in bintang:
                hasil, _ = reviews(app_id, lang=lang, country=country, sort=Sort.NEWEST, count=per_putaran,
                                   filter_score_with=skor)
                for r in hasil:
                    yield Temuan(
                        jenis="ulasan",
                        id_asli=r.get("reviewId", ""),
                        judul=f"{judul_app} (★{r.get('score')})",
                        teks=bersihkan(r.get("content")),
                        url=f"https://play.google.com/store/apps/details?id={app_id}&reviewId={r.get('reviewId', '')}",
                        penulis=r.get("userName", ""),
                        waktu_terbit=ke_iso(r.get("at")),  # pustaka memberi waktu lokal tanpa zona
                        bahasa=lang,
                        metrik={"bintang": r.get("score"), "suka": r.get("thumbsUpCount"), "aplikasi": app_id,
                                "versi_aplikasi": r.get("reviewCreatedVersion"),
                                "balasan_developer": bersihkan(r.get("replyContent"))},
                        mentah=r,
                    )
