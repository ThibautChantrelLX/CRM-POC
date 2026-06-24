#!/usr/bin/env python3
"""Enrichissement Structure(s) des avocats PP via GetAvocatByCnbf.

Pour chaque avocat individuel dans extraction_barreau_paris_pp.csv,
appelle le endpoint de détail et remplit la colonne Structure(s)
depuis le champ `structures` de la fiche (source officielle).

Fonctionnalités :
  - Parallélisation (5 workers par défaut)
  - Reprise automatique via fichier de checkpoint JSON
  - Sauvegarde périodique du CSV (tous les 500 avocats)

Usage :
  python3 enrich_pp.py
  python3 enrich_pp.py --workers 10
"""

import argparse
import csv
import json
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional

import requests
from dotenv import load_dotenv
import datetime

load_dotenv()

_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(_DIR)
_DATE = os.environ.get("EXTRACTION_DATE", datetime.date.today().strftime("%Y-%m-%d"))

INPUT = os.path.join(
    ROOT, "output", "BarreauParis", f"{_DATE}_extraction_barreau_paris_pp.csv"
)
OUTPUT = INPUT  # mise à jour sur place
CHECKPOINT = os.path.join(
    ROOT, "output", "BarreauParis", f".{_DATE}_enrich_pp_checkpoint.json"
)
DETAIL_URL = "https://apiresteannuairemiddleware.avocatparis.org/api/GetAvocatByCnbf"
ENV_TOKEN = "BARREAU_PARIS_BEARER_TOKEN"

REQ_HEADERS = {
    "Accept": "*/*",
    "Accept-Language": "fr-FR,fr;q=0.9",
    "Connection": "keep-alive",
    "Origin": "https://www.avocatparis.org",
    "Referer": "https://www.avocatparis.org/",
    "User-Agent": "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36",
}

SAVE_EVERY = 500


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Enrichissement Structure(s) des PP via GetAvocatByCnbf."
    )
    parser.add_argument(
        "--token", help="Bearer token (sinon BARREAU_PARIS_BEARER_TOKEN)."
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=5,
        help="Nombre de workers parallèles (défaut: 5).",
    )
    return parser.parse_args()


def build_headers(token: str) -> dict:
    h = dict(REQ_HEADERS)
    h["Authorization"] = f"Bearer {token.strip()}"
    return h


def fetch_detail(cnbf: str, token: str, session: requests.Session) -> Optional[dict]:
    """Retourne un dict {'structures': str, 'activites': str} ou None en cas d'erreur."""
    try:
        resp = session.get(
            DETAIL_URL, headers=build_headers(token), params={"cnbf": cnbf}, timeout=15
        )
        if resp.status_code == 401:
            raise RuntimeError("Token expiré (401)")
        if not resp.ok:
            return None
        fiches = resp.json().get("fiche_avocats", [])
        if not fiches:
            return None
        fiche = fiches[0]

        structs = fiche.get("structures", []) or []
        activites = fiche.get("activites_dominantes", []) or []
        specs = fiche.get("specialites", []) or []

        def join_field(lst):
            parts = []
            for item in lst:
                if isinstance(item, str) and item:
                    parts.append(item)
                elif isinstance(item, dict):
                    v = (
                        item.get("libelle")
                        or item.get("LIBELLE")
                        or item.get("nom")
                        or ""
                    )
                    if v:
                        parts.append(v)
            return " | ".join(parts)

        return {
            "structures": " | ".join(s["nom"] for s in structs if s.get("nom")),
            "activites": join_field(activites),
            "specialites": join_field(specs),
            "date_serment": fiche.get("date_serment", "") or "",
        }
    except RuntimeError:
        raise
    except Exception:
        return None


def load_checkpoint() -> dict:
    if not os.path.exists(CHECKPOINT):
        return {}
    with open(CHECKPOINT, encoding="utf-8") as f:
        return json.load(f)


def save_checkpoint(data: dict) -> None:
    with open(CHECKPOINT, "w", encoding="utf-8") as f:
        json.dump(data, f)


def save_csv(rows: list, fieldnames: list) -> None:
    with open(OUTPUT, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(
            f, fieldnames=fieldnames, delimiter=";", extrasaction="ignore"
        )
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    args = parse_args()
    token = args.token or os.environ.get(ENV_TOKEN, "")
    if not token:
        raise SystemExit(f"Token requis : --token ou {ENV_TOKEN} dans .env")

    if not os.path.exists(INPUT):
        raise SystemExit(
            f"Fichier PP introuvable : {INPUT}\n"
            "Lancez d'abord : python3 barreau_paris.py post"
        )

    # ── Lecture CSV ────────────────────────────────────────────────────────
    with open(INPUT, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f, delimiter=";")
        rows = list(reader)
        fieldnames = list(reader.fieldnames or [])

    print(f"{len(rows)} avocats PP chargés.")

    # ── Ajout des colonnes enrichies si absentes ───────────────────────────
    ACT_COL = "Activité(s) dominante(s)"
    SPEC_COL = "Spécialité(s)"
    DATE_COL = "Date serment"
    for col in (ACT_COL, SPEC_COL, DATE_COL):
        if col not in fieldnames:
            fieldnames.append(col)
    for row in rows:
        row.setdefault(ACT_COL, "")
        row.setdefault(SPEC_COL, "")
        row.setdefault(DATE_COL, "")

    # ── Checkpoint ─────────────────────────────────────────────────────────
    checkpoint = load_checkpoint()
    todo = [r for r in rows if r["ID Contact"] not in checkpoint]
    done_count = len(rows) - len(todo)
    if done_count:
        print(f"Reprise : {done_count} déjà traités, {len(todo)} restants.")

    # Appliquer les résultats déjà en checkpoint
    for row in rows:
        cid = row["ID Contact"]
        if cid in checkpoint and isinstance(checkpoint[cid], dict):
            row["Structure(s)"] = checkpoint[cid].get("structures", "")
            row[ACT_COL] = checkpoint[cid].get("activites", "")
            row[SPEC_COL] = checkpoint[cid].get("specialites", "")
            row[DATE_COL] = checkpoint[cid].get("date_serment", "")

    # ── Enrichissement parallèle ───────────────────────────────────────────
    print(f"\nEnrichissement via GetAvocatByCnbf ({args.workers} workers)...")
    start = time.time()
    processed = 0
    errors = 0

    # Index identifiant → row pour mise à jour rapide
    row_by_id = {r["ID Contact"]: r for r in rows}

    with requests.Session() as session:
        with ThreadPoolExecutor(max_workers=args.workers) as executor:
            futures = {
                executor.submit(fetch_detail, r["ID Contact"], token, session): r[
                    "ID Contact"
                ]
                for r in todo
            }
            for future in as_completed(futures):
                cnbf = futures[future]
                try:
                    detail = future.result()
                except RuntimeError as exc:
                    executor.shutdown(wait=False, cancel_futures=True)
                    save_checkpoint(checkpoint)
                    save_csv(rows, fieldnames)
                    raise SystemExit(
                        f"\n⚠️  {exc}\n"
                        "Mettez à jour BARREAU_PARIS_BEARER_TOKEN dans .env et relancez."
                    )

                detail = detail or {
                    "structures": "",
                    "activites": "",
                    "specialites": "",
                    "date_serment": "",
                }
                checkpoint[cnbf] = detail
                row = row_by_id[cnbf]
                row["Structure(s)"] = detail["structures"]
                row[ACT_COL] = detail["activites"]
                row[SPEC_COL] = detail["specialites"]
                row[DATE_COL] = detail["date_serment"]
                if not detail["structures"]:
                    errors += 1

                processed += 1
                if processed % SAVE_EVERY == 0:
                    save_checkpoint(checkpoint)
                    save_csv(rows, fieldnames)
                    elapsed = time.time() - start
                    rate = processed / elapsed
                    remaining = (len(todo) - processed) / rate if rate > 0 else 0
                    found_s = sum(
                        1
                        for v in checkpoint.values()
                        if isinstance(v, dict) and v.get("structures")
                    )
                    found_a = sum(
                        1
                        for v in checkpoint.values()
                        if isinstance(v, dict) and v.get("activites")
                    )
                    found_sp = sum(
                        1
                        for v in checkpoint.values()
                        if isinstance(v, dict) and v.get("specialites")
                    )
                    print(
                        f"  [{processed:6d}/{len(todo)}]  struct: {found_s}  act: {found_a}  spec: {found_sp}  "
                        f"ETA: ~{remaining / 60:.0f} min"
                    )

    # ── Sauvegarde finale ──────────────────────────────────────────────────
    save_checkpoint(checkpoint)
    save_csv(rows, fieldnames)

    n = len(rows)
    found_s = sum(1 for r in rows if r.get("Structure(s)", "").strip())
    found_a = sum(1 for r in rows if r.get(ACT_COL, "").strip())
    found_sp = sum(1 for r in rows if r.get(SPEC_COL, "").strip())
    found_d = sum(1 for r in rows if r.get(DATE_COL, "").strip())
    elapsed = time.time() - start
    print(f"\nTerminé en {elapsed / 60:.1f} min")
    print(f"Structure(s) renseignée  : {found_s}/{n} ({found_s * 100 // n}%)")
    print(f"Activité(s) renseignée   : {found_a}/{n} ({found_a * 100 // n}%)")
    print(f"Spécialité(s) renseignée : {found_sp}/{n} ({found_sp * 100 // n}%)")
    print(f"Date serment renseignée  : {found_d}/{n} ({found_d * 100 // n}%)")
    print(f"CSV mis à jour           : {OUTPUT}")

    if os.path.exists(CHECKPOINT):
        os.remove(CHECKPOINT)


if __name__ == "__main__":
    main()
