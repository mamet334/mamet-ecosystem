"""Pseudonim penulis: penulis yang sama tetap satu orang, tanpa membawa identitasnya (ADR-CRW-0002 butir 4)."""

import hashlib
import hmac


def pseudonim(garam: str, sumber: str, username: str) -> str:
    if not username:
        return ""
    pesan = f"{sumber}:{username.strip().lower()}".encode("utf-8")
    return "p_" + hmac.new(garam.encode("utf-8"), pesan, hashlib.sha256).hexdigest()[:16]
