# Referensi Sumber Kandidat

Daftar platform tepercaya yang layak ditambahkan sebagai sumber, untuk menyeimbangkan sumber sosial yang berisik
(Bluesky, YouTube) dengan sumber yang **otoritatif, terverifikasi, dan beragam**. Disusun 2026-10-22 dari riset web.

Catatan: "akurat" tetap ditentukan Mamet (Knowledge System, verifikasi). Daftar ini menambah *ragam dan bobot*
sumbernya, bukan menjadikan data otomatis benar.

## A. Cek fakta / lawan hoaks (langsung relevan tema buzzer & hoaks)

| Sumber | Akses | Kunci? | Nilai |
|---|---|---|---|
| **turnbackhoax.id** (Mafindo) | RSS feed `/feed` ✅ **sudah dibangun** (sumber `turnbackhoax`) | Tidak | Bantahan hoaks berlabel `[SALAH]`/`[PENIPUAN]` |
| **cekfakta.com** (aliansi media) | Kemungkinan RSS (belum diverifikasi) | Tidak | Cek fakta bersama media terverifikasi |

## B. Statistik & data resmi (otoritatif)

| Sumber | Akses | Kunci? | Nilai |
|---|---|---|---|
| **BPS WebAPI** (webapi.bps.go.id) | REST JSON, daftar di `/developer/` | Ya (gratis) | Angka resmi: inflasi, kemiskinan, kependudukan |
| **data.go.id** (Satu Data, Bappenas) | Portal dataset; API per-dataset bervariasi | Bervariasi | Dataset lintas sektor pemerintah |
| **World Bank API** | REST JSON | Tidak | Statistik global pembanding |

## C. Ilmu pengetahuan / akademik (untuk topik seperti fisika)

| Sumber | Akses | Kunci? | Nilai |
|---|---|---|---|
| **OpenAlex** (api.openalex.org) | REST JSON ✅ **sudah dibangun** (sumber `openalex`) | Tidak | 250jt+ karya ilmiah; terbaik & termudah untuk sains |
| **arXiv API** (export.arxiv.org/api) | Atom XML ✅ **sudah dibangun** (sumber `arxiv`) | Tidak | Preprint fisika, matematika, CS |
| **Crossref** (api.crossref.org) | REST JSON | Tidak | Metadata & DOI jurnal |
| **Semantic Scholar** (api.semanticscholar.org) | REST JSON | Opsional | Abstrak + sitasi |
| **Garuda** (garuda.kemdiktisaintek.go.id) | Lewat `web` (tak ada API jelas) | Tidak | Jurnal Indonesia |

## D. Ensiklopedia & rujukan terverifikasi

| Sumber | Akses | Kunci? | Nilai |
|---|---|---|---|
| **Wikipedia API** (id/en.wikipedia.org/w/api.php) | REST JSON ✅ **sudah dibangun** (sumber `wikipedia`) | Tidak | Ensiklopedi bersitasi; rujukan latar |
| **Wikidata** | REST/SPARQL | Tidak | Fakta terstruktur |

## E. Q&A teknis & diskusi (sudah dikenal dari proyek lama)

| Sumber | Akses | Kunci? | Nilai |
|---|---|---|---|
| **Stack Exchange API** | REST JSON ✅ **sudah dibangun** (sumber `stackexchange`) | Opsional | Tanya-jawab teknis, rekomendasi software |
| **Hacker News (Algolia)** | REST JSON | Tidak | Diskusi teknologi global |

## F. Pengaduan publik

| Sumber | Akses | Kunci? | Nilai |
|---|---|---|---|
| **LAPOR! SP4N** (lapor.go.id) | Perlu dicek (web/API) | — | Pengaduan warga ke pemerintah |

## Rekomendasi batch pertama (mudah + bernilai tinggi)

1. **turnbackhoax** — cek fakta, feed terverifikasi, pola sama `mediakonsumen`. Langsung mendukung tema buzzer/hoaks.
2. **OpenAlex** — sains, gratis tanpa kunci, untuk topik pengetahuan seperti fisika.
3. **Wikipedia** — rujukan ensiklopedis, gratis.
4. **BPS WebAPI** — angka resmi (perlu kunci gratis dari webapi.bps.go.id).

Keempatnya menyeimbangkan sumber sosial dengan sumber cek-fakta, ilmiah, ensiklopedis, dan statistik resmi.
