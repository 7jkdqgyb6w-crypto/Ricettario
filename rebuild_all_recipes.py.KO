#!/usr/bin/env python3
"""Risalva in batch tutte le ricette passando dal flusso reale del CMS.

Obiettivo:
- leggere ogni ricetta tramite services.loader.load_recipe()
- risalvarla tramite services.saver.save_recipe()
- quindi reinserire footer licenza + QR e normalizzare il markup
  usando ESATTAMENTE la stessa logica del CMS web.

Uso tipico:
  python rebuild_all_recipes.py
  python rebuild_all_recipes.py --slug agnolotti-al-sugo-d-arrosto
  python rebuild_all_recipes.py --root "G:\\Il mio Drive\\Esperienze\\Ricette"

Note di sicurezza:
- ogni save_recipe() crea un backup .bak del file index.html prima di scrivere;
- lo script non tocca index root, style.css, indici o immagini diverse dai QR;
- i QR vengono rigenerati dal saver dentro foto/<slug>/qr-code.png.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from services.loader import list_recipes, load_recipe
from services.saver import save_recipe


def detect_site_root(start: Path) -> Path:
    """Trova la root del sito in modo robusto.

    Casi supportati:
    - script lanciato dalla root del sito
    - script lanciato dalla cartella del CMS (parent = root del sito)
    - path esplicito passato via --root
    """
    start = start.resolve()

    candidates = [start, start.parent]
    for candidate in candidates:
        if (candidate / "ricette").is_dir() and (candidate / "foto").is_dir():
            return candidate
    raise FileNotFoundError(
        "Root del sito non trovata. Atteso ricette/ e foto/ nella cartella corrente o nel parent."
    )


def rebuild_one(root: Path, slug: str) -> tuple[bool, str]:
    try:
        data = load_recipe(str(root), slug)
        save_recipe(str(root), slug, data)
        return True, f"OK {slug}"
    except Exception as exc:  # pragma: no cover - defensive runtime path
        return False, f"ERRORE {slug} - {exc}"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Risalva tutte le ricette tramite il saver del CMS")
    parser.add_argument("--root", help="Root del sito (default: rilevata automaticamente)")
    parser.add_argument("--slug", help="Risalva solo una ricetta specifica")
    args = parser.parse_args(argv)

    try:
        root = Path(args.root).resolve() if args.root else detect_site_root(Path.cwd())
    except Exception as exc:
        print(f"ERRORE root - {exc}")
        return 2

    print("===== REBUILD RICETTE =====")
    print(f"Root sito: {root}")

    if args.slug:
        recipe_path = root / "ricette" / args.slug / "index.html"
        if not recipe_path.exists():
            print(f"ERRORE slug - ricetta non trovata: {args.slug}")
            return 2
        ok, msg = rebuild_one(root, args.slug)
        print(msg)
        print()
        print(f"Ricette risalvate: {1 if ok else 0}")
        print(f"Errori: {0 if ok else 1}")
        return 0 if ok else 1

    items = list_recipes(str(root))
    if not items:
        print(f"Nessuna ricetta trovata in {root / 'ricette'}")
        return 2

    print(f"Ricette trovate: {len(items)}")
    ok_count = 0
    ko_count = 0

    for item in items:
        slug = (item or {}).get("slug")
        if not slug:
            ko_count += 1
            print("ERRORE <slug mancante>")
            continue
        ok, msg = rebuild_one(root, slug)
        print(msg)
        if ok:
            ok_count += 1
        else:
            ko_count += 1

    print()
    print(f"Ricette risalvate: {ok_count}")
    print(f"Errori: {ko_count}")
    return 0 if ko_count == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
