#!/usr/bin/env python3
"""Orchestrateur d'extraction — une commande par source.

Usage :
    uv run python main.py barotech --cookie "..." --token "..." --base64 "..."
    uv run python main.py amiens
    uv run python main.py paris --token "..."
"""

import argparse
import datetime
import os
import subprocess
import sys

_DIR = os.path.dirname(os.path.abspath(__file__))
PY = sys.executable


def run(label, cmd, env):
    print(f"\n{'─' * 60}")
    print(f"  {label}")
    print(f"{'─' * 60}")
    result = subprocess.run(cmd, cwd=_DIR, env=env)
    if result.returncode != 0:
        print(f"\n❌  Étape échouée (code {result.returncode}) — pipeline interrompue.")
        sys.exit(result.returncode)


# ─── BarOtech ─────────────────────────────────────────────────────────────────

def pipeline_barotech(args):
    date = datetime.date.today().strftime("%Y-%m-%d")
    env = {**os.environ, "EXTRACTION_DATE": date}
    creds = ["--cookie", args.cookie, "--token", args.token, "--base64", args.base64]

    run("1/5 — Extraction brute", [PY, "BarOtech/extraction_barotech.py", *creds], env)
    run("2/5 — Enrichissement spécialités", [PY, "BarOtech/enrich_specialites.py", *creds], env)
    run("3/5 — Enrichissement activités dominantes", [PY, "BarOtech/enrich_activites.py", *creds], env)
    run("4/5 — Enrichissement fiches (case + date serment)", [PY, "BarOtech/enrich_fiches.py", "--cookie", args.cookie], env)
    run("5/5 — Enrichissement structures SIRENE", [PY, "BarOtech/enrich_structures_sirene.py"], env)

    print("\n✅  Pipeline BarOtech terminée.")
    print(f"    CSV produits (préfixe {date}) :")
    print(f"      BarOtech/{date}_extraction_barotech.csv")
    print(f"      BarOtech/{date}_extraction_barotech_specialities.csv")
    print(f"      BarOtech/{date}_extraction_barotech_specialities_activites.csv")
    print(f"      BarOtech/{date}_extraction_structures_sirene.csv")


# ─── BarreauAmiens ────────────────────────────────────────────────────────────

def pipeline_amiens(args):
    date = datetime.date.today().strftime("%Y-%m-%d")
    env = {**os.environ, "EXTRACTION_DATE": date}
    cmd = [PY, "BarreauAmiens/extract.py"]
    if args.nom:
        cmd += ["--nom", args.nom]
    if args.delay:
        cmd += ["--delay", str(args.delay)]

    run("1/1 — Extraction annuaire d'Amiens", cmd, env)

    print("\n✅  Pipeline BarreauAmiens terminée.")
    print(f"    CSV produit (préfixe {date}) :")
    print(f"      output/BarreauAmiens/{date}_extraction_barreau_amiens.csv")


# ─── BarreauParis ─────────────────────────────────────────────────────────────

def pipeline_paris(args):
    token_env = os.environ.get("BARREAU_PARIS_BEARER_TOKEN", "")
    token = args.token or token_env
    if not token:
        print("❌  Token manquant — utilise --token ou BARREAU_PARIS_BEARER_TOKEN")
        sys.exit(1)

    date = datetime.date.today().strftime("%Y-%m-%d")
    env = {**os.environ, "EXTRACTION_DATE": date}

    run("1/3 — Extraction annuaire de Paris", [PY, "BarreauParis/extract.py", "--token", token], env)
    run("2/3 — Post-traitement (split PP / Structures + SIRENE)", [PY, "BarreauParis/post_process.py"], env)
    run("3/3 — Enrichissement fiches PP (structures, spécialités, date)", [PY, "BarreauParis/enrich_pp.py", "--token", token], env)

    print("\n✅  Pipeline BarreauParis terminée.")
    print(f"    CSV produits (préfixe {date}) :")
    print(f"      output/BarreauParis/{date}_extraction_barreau_paris.csv")
    print(f"      output/BarreauParis/{date}_extraction_barreau_paris_pp.csv")
    print(f"      output/BarreauParis/{date}_extraction_structures_barreau_paris.csv")


# ─── CLI ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Orchestrateur d'extraction CRM LX",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
exemples :
  uv run python main.py barotech --cookie "..." --token "..." --base64 "..."
  uv run python main.py amiens
  uv run python main.py paris --token "eyJ..."
""",
    )
    sub = parser.add_subparsers(dest="source", required=True)

    # barotech
    p_bt = sub.add_parser("barotech", help="Pipeline complète BarOtech (5 étapes)")
    p_bt.add_argument("--cookie", default=os.environ.get("BAROTECH_COOKIE", ""), required=not os.environ.get("BAROTECH_COOKIE"))
    p_bt.add_argument("--token", default=os.environ.get("BAROTECH_TOKEN", ""), required=not os.environ.get("BAROTECH_TOKEN"))
    p_bt.add_argument("--base64", dest="base64", default=os.environ.get("BAROTECH_BASE64", ""), required=not os.environ.get("BAROTECH_BASE64"))

    # amiens
    p_am = sub.add_parser("amiens", help="Pipeline complète Barreau d'Amiens (1 étape)")
    p_am.add_argument("--nom", default="", help="Tester un seul nom")
    p_am.add_argument("--delay", type=float, default=None, help="Délai entre requêtes (s)")

    # paris
    p_pa = sub.add_parser("paris", help="Pipeline complète Barreau de Paris (3 étapes)")
    p_pa.add_argument("--token", default=os.environ.get("BARREAU_PARIS_BEARER_TOKEN", ""))

    args = parser.parse_args()

    if args.source == "barotech":
        pipeline_barotech(args)
    elif args.source == "amiens":
        pipeline_amiens(args)
    elif args.source == "paris":
        pipeline_paris(args)


if __name__ == "__main__":
    main()
