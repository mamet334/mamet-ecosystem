"""Pencocokan kata kunci (Mamet 2026-10-27): kata pendek & akronim wajib kata utuh, kata lain tetap potongan teks.

Kasus diambil dari korpus nyata: misi "Ogan Komering Ulu" (gudang Mamet) dan gudang crawler lama (466 tangkapan).
"""

from crawler.inti.teks import ada_kata, kata_kunci_cocok, kata_kunci_pendek


def test_akronim_pendek_tidak_cocok_di_tengah_kata():
    # 14/14 tangkapan rss_media misi OKU lolos karena "OKU" ada di "F-oku-s".
    assert kata_kunci_cocok("Fokus pada edukasi pengendara", ["OKU"]) == []
    assert kata_kunci_cocok("penegakan hukum jadi fokus utama", ["OKU"]) == []
    # Gudang lama: "ASN" di "at-asn-ya" dan "Bat-asn-ya".
    assert kata_kunci_cocok("jatah di atasnya digeser", ["ASN"]) == []
    assert kata_kunci_cocok("Apa Itu ARB yang Batasnya Baru Diturunkan", ["ASN"]) == []


def test_akronim_pendek_cocok_sebagai_kata_utuh():
    assert kata_kunci_cocok("Kapolres OKU Gelar Minggu Kasih", ["OKU"]) == ["OKU"]
    assert kata_kunci_cocok("Latihan Pra Operasi di OKU-Timur", ["OKU"]) == ["OKU"]
    assert kata_kunci_cocok("(OKU) Sumatera Selatan", ["OKU"]) == ["OKU"]
    assert kata_kunci_cocok("berita oku hari ini", ["OKU"]) == ["OKU"], "tetap tak peka huruf besar"
    assert kata_kunci_cocok("tunjangan ASN naik", ["ASN"]) == ["ASN"]
    # Batas yang diketahui: akronim dirangkai huruf lain tidak cocok (OKUT = OKU Timur → kata kunci sendiri).
    assert kata_kunci_cocok("Bupati OKUT meresmikan", ["OKU"]) == []


def test_kata_kunci_panjang_tetap_potongan_teks_imbuhan():
    assert kata_kunci_cocok("Kejaksaan usut korupsinya", ["korupsi"]) == ["korupsi"]
    assert kata_kunci_cocok("Warga kebanjiran sejak pagi", ["banjir"]) == ["banjir"]
    assert kata_kunci_cocok("everyone shifting toward side hustles", ["side hustle"]) == ["side hustle"]
    assert kata_kunci_cocok("Bupati Ogan Komering Ulu meresmikan", ["Ogan Komering Ulu", "OKU"]) == ["Ogan Komering Ulu"]


def test_siapa_yang_pendek():
    assert kata_kunci_pendek("OKU") and kata_kunci_pendek("oku") and kata_kunci_pendek("ASN")
    assert kata_kunci_pendek("BPJS") and kata_kunci_pendek("KEMENDAGRI"), "akronim panjang (huruf besar) juga kata utuh"
    assert not kata_kunci_pendek("banjir") and not kata_kunci_pendek("Mobile JKN") and not kata_kunci_pendek("side hustle")


def test_ada_kata_ikut_aturan_yang_sama():
    # ada_kata dipakai rss_media/inbox/mediakonsumen untuk menyaring, dan dispatcher untuk kata_kunci_kecuali.
    assert not ada_kata("Fokus pada kerugian negara", ["OKU"])
    assert ada_kata("Polres OKU", ["OKU"])
    assert not ada_kata("jatah di atasnya", ["ASN"]), "kata_kunci_kecuali pendek tak lagi membuang tangkapan keliru"
