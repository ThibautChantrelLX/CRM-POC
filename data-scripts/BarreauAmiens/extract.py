#!/usr/bin/env python3
"""Extraction des avocats du Barreau d'Amiens.

Stratégie :
  1. GET /annuaire/result → extrait le tableau JS `var names = [...]`
     (liste exhaustive des noms de famille de tous les avocats inscrits)
  2. Pour chaque nom, POST /annuaire/result?name=NOM → parse les cards HTML
     → nom complet, adresse, téléphone, email (décodé depuis data-mailto),
        date de serment
  3. Déduplication par nom complet normalisé
  → Sortie : output/BarreauAmiens/extraction_barreau_amiens.csv

Usage :
  python3 extract.py                  # extraction complète
  python3 extract.py --nom "MARTIN"   # test sur un nom
"""

import argparse
import csv
import os
import re
import time

import requests
from bs4 import BeautifulSoup

_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(_DIR)

BASE_URL = "https://www.barreau-amiens.avocat.fr"
SEARCH_URL = f"{BASE_URL}/annuaire/result"

DEFAULT_OUTPUT = os.path.join(
    ROOT, "output", "BarreauAmiens", "extraction_barreau_amiens.csv"
)

REQ_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Content-Type": "application/x-www-form-urlencoded",
    "Origin": BASE_URL,
    "Referer": f"{BASE_URL}/annuaire",
}

CSV_HEADER = [
    "Nom Complet",
    "Barreau",
    "Téléphone(s)",
    "Adresse(s)",
    "Email(s)",
    "Structure(s)",
    "Date serment",
]


# ──────────────────────────────────────────────────────────────────────────────
# Args
# ──────────────────────────────────────────────────────────────────────────────


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extraction Barreau d'Amiens.")
    parser.add_argument("--nom", default="", help="Tester un seul nom (mode ciblé).")
    parser.add_argument(
        "--output", default=DEFAULT_OUTPUT, help="Chemin du CSV de sortie."
    )
    parser.add_argument(
        "--delay", type=float, default=0.3, help="Délai entre requêtes (s, défaut 0.3)."
    )
    return parser.parse_args()


# ──────────────────────────────────────────────────────────────────────────────
# Décodage email obfusqué
# ──────────────────────────────────────────────────────────────────────────────


def decode_mailto(value: str) -> str:
    """Décode data-mailto="tld|domain|user" → user@domain.tld"""
    if not value:
        return ""
    parts = value.strip().split("|")
    if len(parts) == 3:
        tld, domain, user = parts
        return f"{user}@{domain}.{tld}"
    return ""


# ──────────────────────────────────────────────────────────────────────────────
# Extraction des noms depuis la page principale
# ──────────────────────────────────────────────────────────────────────────────


def fetch_names(session: requests.Session) -> list:
    """GET /annuaire/result → extrait le tableau JS var names = [...]."""
    resp = session.get(SEARCH_URL, headers=REQ_HEADERS, timeout=30)
    resp.raise_for_status()
    match = re.search(r"var\s+names\s*=\s*(\[.*?\]);", resp.text, re.DOTALL)
    if not match:
        raise RuntimeError(
            "Tableau JS `var names` introuvable dans la page. "
            "La structure du site a peut-être changé."
        )
    import json

    names = json.loads(match.group(1))
    print(f"  {len(names)} noms extraits du tableau JS.")
    return names


# ──────────────────────────────────────────────────────────────────────────────
# Parsing d'une card avocat
# ──────────────────────────────────────────────────────────────────────────────


def parse_card(div) -> dict:
    """Extrait les données d'un bloc <div class="media">."""
    body = div.find("div", class_="media-body")
    if not body:
        return {}

    h3 = body.find("h3")
    nom = h3.get_text(strip=True) if h3 else ""

    # Adresse + téléphone : dans le premier <li>
    adresse = ""
    telephone = ""
    li_tags = body.find_all("li")
    for li in li_tags:
        tel_span = li.find("span", class_="tel")
        if tel_span:
            telephone = tel_span.get_text(strip=True)
            tel_span.extract()
        # Le reste du li est l'adresse
        raw = li.get_text(separator=" ", strip=True)
        raw = re.sub(r"\s+", " ", raw).strip()
        if raw:
            adresse = raw
        break  # un seul li d'adresse attendu

    # Email
    mailto_tag = body.find("a", attrs={"data-mailto": True})
    email = decode_mailto(mailto_tag["data-mailto"]) if mailto_tag else ""

    # Date de serment
    serment = ""
    small = body.find("small")
    if small:
        text = small.get_text(strip=True)
        m = re.search(r"serment\s*:\s*(.+)", text, re.IGNORECASE)
        if m:
            serment = m.group(1).strip()

    return {
        "Nom Complet": nom,
        "Barreau": "Barreau d'Amiens",
        "Téléphone(s)": telephone,
        "Adresse(s)": adresse,
        "Email(s)": email,
        "Structure(s)": "",
        "Date serment": serment,
    }


# ──────────────────────────────────────────────────────────────────────────────
# Recherche par nom
# ──────────────────────────────────────────────────────────────────────────────


def search_name(session: requests.Session, nom: str) -> list:
    """POST /annuaire/result?name=NOM → liste de dicts avocats."""
    data = {"name": nom, "secteur": "", "spe": ""}
    resp = session.post(SEARCH_URL, headers=REQ_HEADERS, data=data, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    cards = soup.find_all("div", class_="media")
    results = []
    for card in cards:
        row = parse_card(card)
        if row.get("Nom Complet"):
            results.append(row)
    return results


# ──────────────────────────────────────────────────────────────────────────────
# Sauvegarde CSV
# ──────────────────────────────────────────────────────────────────────────────


def save_csv(rows: list, output: str) -> None:
    os.makedirs(os.path.dirname(output), exist_ok=True)
    with open(output, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(
            f, fieldnames=CSV_HEADER, delimiter=";", extrasaction="ignore"
        )
        writer.writeheader()
        writer.writerows(rows)
    print(f"CSV : {output}  ({len(rows)} lignes)")


# ──────────────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────────────


def main() -> None:
    args = parse_args()

    with requests.Session() as session:
        if args.nom:
            print(f"Mode ciblé : nom={args.nom!r}")
            rows = search_name(session, args.nom)
        else:
            print("Extraction des noms depuis la page principale...")
            names = fetch_names(session)

            all_rows: dict = {}
            skipped = 0
            start = time.time()

            for i, nom in enumerate(names, start=1):
                try:
                    results = search_name(session, nom)
                except Exception as exc:
                    print(f"  ⚠️  {nom} : {exc}")
                    skipped += 1
                    continue

                for r in results:
                    key = r["Nom Complet"].upper()
                    all_rows[key] = r

                if i % 50 == 0:
                    elapsed = time.time() - start
                    rate = i / elapsed
                    remaining = (len(names) - i) / rate if rate > 0 else 0
                    print(
                        f"  [{i:3d}/{len(names)}]  corpus: {len(all_rows):4d}  "
                        f"ETA: ~{remaining / 60:.1f} min"
                    )

                time.sleep(args.delay)

            rows = list(all_rows.values())
            print(f"\nTotal unique : {len(rows)} avocats  (erreurs: {skipped})")

    if not rows:
        print("Aucun résultat.")
        return

    save_csv(rows, args.output)


if __name__ == "__main__":
    main()
