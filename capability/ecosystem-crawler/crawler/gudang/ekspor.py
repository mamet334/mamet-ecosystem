"""Ekspor hasil misi untuk mode mandiri (ADR-CRW-0006 butir 3): CSV (Excel), JSONL (AI/skrip), MD (daftar).
Ekspor hanya menyusun ulang data, tanpa analisis. Username asli keluar hanya bila misinya mengizinkan."""

import csv
import json
from collections import defaultdict
from pathlib import Path

KOLOM_CSV = (
    "sumber", "jenis", "judul", "teks", "url", "waktu_terbit", "penulis", "metrik", "kata_kunci_cocok",
    "confidence", "url_induk", "parent_id", "id", "id_asli", "kanal", "jenis_akses", "waktu_ambil", "status_misi",
)
FORMAT = ("csv", "jsonl", "md")


def ekspor(gudang, misi_id: str, formats: list[str], folder: Path) -> list[Path]:
    misi = gudang.misi(misi_id)
    if not misi:
        raise KeyError(f"misi {misi_id} tidak ditemukan")
    buka = bool(misi["spesifikasi"]["payload"].get("buka_identitas_penulis"))
    rows = gudang.baca_semua(misi_id, buka_identitas=buka)
    for r in rows:
        asli = r.pop("penulis", None) if buka else None
        r["penulis"] = asli or r["penulis_hash"]

    folder = Path(folder) / misi_id
    folder.mkdir(parents=True, exist_ok=True)
    keluar = []
    if "csv" in formats:
        keluar.append(_csv(rows, folder / "tangkapan.csv"))
    if "jsonl" in formats:
        keluar.append(_jsonl(rows, folder / "tangkapan.jsonl"))
    if "md" in formats:
        keluar.append(_md(misi, rows, folder / "daftar.md"))
    return keluar


def _csv(rows: list[dict], path: Path) -> Path:
    # utf-8-sig agar Excel membaca huruf non-ASCII dengan benar.
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=KOLOM_CSV, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow({**r, "metrik": json.dumps(r["metrik"], ensure_ascii=False),
                        "kata_kunci_cocok": ", ".join(r["kata_kunci_cocok"])})
    return path


def _jsonl(rows: list[dict], path: Path) -> Path:
    with path.open("w", encoding="utf-8") as f:
        for r in rows:
            r = {k: v for k, v in r.items() if k not in ("urut", "penulis_hash")}
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    return path


def _md(misi: dict, rows: list[dict], path: Path) -> Path:
    spec = misi["spesifikasi"]
    ringkasan = misi.get("ringkasan") or {}
    per_sumber = defaultdict(list)
    for r in rows:
        per_sumber[r["sumber"]].append(r)
    anak = defaultdict(list)
    for r in rows:
        if r["parent_id"]:
            anak[r["parent_id"]].append(r)

    baris = [
        f"# Hasil misi {misi['id']}",
        "",
        f"- Perintah: {spec['context'].get('owner_intent') or '-'}",
        f"- Kata kunci: {', '.join(spec['payload']['kata_kunci']) or '-'}",
        f"- Sumber: {', '.join(spec['payload']['sumber'])}",
        f"- Status: {misi['status']} · total {len(rows)} tangkapan · dibuat {misi['dibuat']}",
        "",
        "> Daftar ini adalah data mentah (status: hypothesis), bukan kesimpulan. Penulis ditampilkan sebagai "
        "pseudonim kecuali misi mengizinkan identitas.",
        "",
    ]
    ids = {r["id"] for r in rows}
    # Urut sesuai misi, termasuk sumber tanpa hasil, agar Owner tahu sumber itu sudah dicoba.
    for sumber in dict.fromkeys([*spec["payload"]["sumber"], *per_sumber]):
        items = per_sumber.get(sumber, [])
        info = (ringkasan.get("per_sumber") or {}).get(sumber, {})
        baris += [f"## {sumber} ({len(items)})", ""]
        if info.get("alasan"):
            baris += [f"_Catatan: {info['alasan']}_", ""]
        if not items:
            baris += ["_Tidak ada tangkapan._", ""]
        akar = [r for r in items if not r["parent_id"] or r["parent_id"] not in ids]
        akar.sort(key=lambda r: r["waktu_terbit"] or "", reverse=True)
        for r in akar:
            baris += _item_md(r, 0)
            for k in sorted(anak.get(r["id"], []), key=lambda r: r["waktu_terbit"] or ""):
                baris += _item_md(k, 1)
        baris.append("")
    path.write_text("\n".join(baris), encoding="utf-8")
    return path


def _item_md(r: dict, level: int) -> list[str]:
    indent = "  " * level
    judul = r["judul"] or (r["teks"][:80] + ("…" if len(r["teks"]) > 80 else ""))
    meta = [r["waktu_terbit"][:10] if r["waktu_terbit"] else "", r["penulis"] or ""]
    meta += [f"{k}: {v}" for k, v in r["metrik"].items() if v not in (None, "", 0)]
    teks = r["teks"][:500] + ("…" if len(r["teks"]) > 500 else "")
    out = [f"{indent}- {'↳ ' if level else ''}[{judul}]({r['url']}) · {' · '.join(m for m in meta if m)}"]
    if teks and teks != r["judul"]:
        out.append(f"{indent}  > {teks}")
    return out
