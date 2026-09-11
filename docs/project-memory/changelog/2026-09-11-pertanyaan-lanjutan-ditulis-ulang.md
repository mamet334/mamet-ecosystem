# Pertanyaan Lanjutan Tidak Lagi Kehilangan Dokumen

**Tanggal:** 11 September 2026
**Roadmap:** Item 67

## Masalahnya

Dalam satu percakapan:

1. *"Menurut dokumen HCDP, jelaskan program pengembangan kompetensi yang direncanakan"* → dijawab
   dari dokumen.
2. *"Lanjutkan, apa kendala utamanya?"* → *"dokumen HCDP tidak tersedia di database saya"*.

Dokumen dicari berdasarkan **makna pesan saat ini saja**. Pesan kedua tidak menyebut HCDP,
kompetensi, atau ASN, jadi tidak mirip dokumen mana pun. Padahal jawabannya ada: kata
"hambatan" muncul di dua potongan HCDP.

## Dua cara diuji dulu, dengan data asli

Diukur lewat Console browser Owner (kunci Owner sendiri, tidak pernah dicetak):

| Cara | Pertanyaan lanjutan | Ganti topik: "apa itu inflasi" |
|---|---|---|
| Pesan apa adanya (sebelumnya) | 0,541, bukan HCDP → tak ada dokumen | 0,528 → tak ada dokumen ✅ |
| Gabungkan pertanyaan sebelumnya + pesan | 0,762 HCDP ✅ | **0,708 HCDP ❌ ikut tertarik** |
| **Tulis ulang oleh model murah** | **0,765 HCDP ✅** | **0,544 → tak ada dokumen ✅** |

Menggabungkan kalimat gagal karena vektor gabungan hampir sama dengan pertanyaan lama saja —
pesan baru nyaris tak berpengaruh. Pertanyaan lanjutan dan ganti topik juga tidak bisa dibedakan
dengan angka kemiripan (0,51 / 0,54 lawan 0,49). Yang bisa membedakannya adalah pemahaman bahasa.

## Perbaikannya

Hanya ketika **pencarian pertama kosong dan sudah ada percakapan sebelumnya**, model murah
(`deepseek-v4-flash`) diminta menulis ulang pesan menjadi pertanyaan yang bisa dipahami sendiri:

- *"Lanjutkan, apa kendala utamanya?"* → *"… kendala utama dalam pelaksanaan program pengembangan
  kompetensi ASN berdasarkan dokumen HCDP tersebut?"* → dicari lagi.
- *"Jelaskan singkat apa itu inflasi"* → dikembalikan apa adanya → tidak dicari lagi.

Dibayar dengan kunci OpenRouter pengguna, seperti embedding.

## Bukti di produksi

| Chat | Hasil | Waktu tambahan | Biaya |
|---|---|---|---|
| Pertanyaan HCDP | langsung ketemu, tidak ditulis ulang | — | — |
| "Lanjutkan, apa kendala utamanya?" | **5 potongan (0,766)**, jawaban mengutip 20 JP, kategori KMS, keterbatasan instrumen | 2,3 detik | $0,000028 |
| "Jelaskan singkat apa itu inflasi" | dinilai sudah mandiri, jawaban bersih dari HCDP | 1,2 detik | ±$0,00003 |

## Yang ditemukan sekalian

Chat ketiga terasa lama, tapi **bukan** karena tulis ulang: pemadat riwayat percakapan meringkas
riwayat dengan AI selama **36,5 detik** sebelum apa pun berjalan. Dikerjakan di Item 68.
