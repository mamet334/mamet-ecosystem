import ast
import io
import os
import sys
import tokenize
from pathlib import Path

os.environ.setdefault("PYTHONIOENCODING", "utf-8")
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

POLA_DIREKTIF = {
    "type: ignore", "noqa", "pragma", "pylint:", "fmt:", "ruff:",
    "isort:", "mypy:", "pyright:", "noreorder", "nosec",
}

AKAR = Path(__file__).resolve().parent.parent


def adalah_direktif(teks_komentar: str) -> bool:
    bersih = teks_komentar.lstrip("# ").strip()
    if bersih.startswith("!"):
        return True
    for pola in POLA_DIREKTIF:
        if pola in bersih:
            return True
    return False


def hapus_komentar_python(teks: str) -> tuple[str, int, int]:
    baris_asli = teks.splitlines(keepends=True)
    buang_baris: set[int] = set()
    potong: dict[int, int] = {}
    dibuang = 0
    dipertahankan = 0

    try:
        tokens = list(tokenize.generate_tokens(io.StringIO(teks).readline))
    except tokenize.TokenError:
        return teks, 0, 0

    for tok in tokens:
        if tok.type != tokenize.COMMENT:
            continue
        if adalah_direktif(tok.string):
            dipertahankan += 1
            continue
        dibuang += 1
        baris_no = tok.start[0]
        kolom = tok.start[1]
        baris_isi = baris_asli[baris_no - 1] if baris_no <= len(baris_asli) else ""
        sebelum = baris_isi[:kolom]
        if sebelum.strip() == "":
            buang_baris.add(baris_no)
        else:
            potong[baris_no] = kolom

    hasil_baris = []
    for i, baris in enumerate(baris_asli, 1):
        if i in buang_baris:
            continue
        if i in potong:
            baris = baris[: potong[i]].rstrip() + "\n"
        hasil_baris.append(baris)

    hasil = "".join(hasil_baris)
    while "\n\n\n" in hasil:
        hasil = hasil.replace("\n\n\n", "\n\n")
    return hasil, dibuang, dipertahankan


def sama_sesudah_ast(lama: str, baru: str) -> bool:
    try:
        return ast.dump(ast.parse(lama)) == ast.dump(ast.parse(baru))
    except SyntaxError:
        return False


def utama():
    tulis = "--tulis" in sys.argv
    berkas = [a for a in sys.argv[1:] if not a.startswith("--")]
    gagal = 0
    for b in berkas:
        alamat = (AKAR / b).resolve()
        lama = alamat.read_text(encoding="utf-8")
        baru, dibuang_n, dipertahankan_n = hapus_komentar_python(lama)
        sama = sama_sesudah_ast(lama, baru)

        sisa = 0
        try:
            for tok in tokenize.generate_tokens(io.StringIO(baru).readline):
                if tok.type == tokenize.COMMENT and not adalah_direktif(tok.string):
                    sisa += 1
        except tokenize.TokenError:
            pass

        status = "SAMA" if sama and sisa == 0 else "BEDA"
        if status == "BEDA":
            gagal += 1
        print(
            f"{status}  {b}  komentar dibuang {dibuang_n}, "
            f"direktif dipertahankan {dipertahankan_n}, sisa {sisa}, "
            f"{len(lama)} → {len(baru)} huruf"
        )
        if tulis and status == "SAMA":
            alamat.write_text(baru, encoding="utf-8")
    if gagal:
        print(
            f"{gagal} berkas DITOLAK (AST berbeda atau komentar tersisa)"
        )
        sys.exit(1)


if __name__ == "__main__":
    utama()
