#!/usr/bin/env python3
"""Extraction des avocats du Barreau de Paris.

Mode complet (défaut, sans --spec/--act/--nom) :
  1. Flux sans filtre  → non-exerçants + structures (~600)
  2. Itération sur tous les bigrammes AA→ZZ (676 requêtes)
     → avocats en exercice dont le nom contient ce bigramme
     → si plafond API atteint (~300), subdivision en trigrammes automatique
  → Déduplication par identifiant → corpus unique (~30 000 avocats)

Mode ciblé (avec --spec, --act ou --nom) :
  → Requêtes uniquement pour ce filtre

Usage:
  python3 extract.py                    # extraction complète (~15-30 min)
  python3 extract.py --nom "Du"         # recherche par nom
  python3 extract.py --spec 19          # par spécialité
  python3 extract.py --act 5            # par activité
  python3 extract.py --list-criteria    # afficher les critères disponibles
"""

import argparse
import csv
import json
import os
import string
import time
from typing import Any, Dict, Iterable, Optional, Tuple

import requests
from dotenv import load_dotenv
import datetime

load_dotenv()

_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(_DIR)
_DATE = os.environ.get("EXTRACTION_DATE", datetime.date.today().strftime("%Y-%m-%d"))

SEARCH_URL = "https://apiresteannuairemiddleware.avocatparis.org/api/GetCombinedAvocatStructureFluxDatas"
DETAIL_URL = "https://apiresteannuairemiddleware.avocatparis.org/api/GetAvocatByCnbf"
CRITERIA_URL = (
    "https://apiresteannuairemiddleware.avocatparis.org/api/GetAllCriteriaList"
)
CRITERIA_FILE = os.path.join(ROOT, "criteria.json")

DEFAULT_OUTPUT = os.path.join(
    ROOT, "output", "BarreauParis", f"{_DATE}_extraction_barreau_paris.csv"
)
PROGRESS_FILE = os.path.join(
    ROOT, "output", "BarreauParis", f".{_DATE}_bigrams_done.txt"
)
ENV_TOKEN = "BARREAU_PARIS_BEARER_TOKEN"

# Seuil à partir duquel on subdivise un bigramme en trigrammes
CAP_THRESHOLD = 280

REQ_HEADERS = {
    "Accept": "*/*",
    "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
    "Connection": "keep-alive",
    "Origin": "https://www.avocatparis.org",
    "Referer": "https://www.avocatparis.org/",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-site",
    "User-Agent": "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36",
    "sec-ch-ua": '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"',
    "sec-ch-ua-mobile": "?1",
    "sec-ch-ua-platform": '"Android"',
}

CSV_HEADER = [
    "ID Contact",
    "Nom Complet",
    "Barreau",
    "Téléphone(s)",
    "Adresse(s)",
    "Email(s)",
    "Structure(s)",
    "Site Web",
]

LETTERS = string.ascii_uppercase


# ──────────────────────────────────────────────────────────────────────────────
# Args
# ──────────────────────────────────────────────────────────────────────────────


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Extraction Barreau de Paris — contacts."
    )
    parser.add_argument(
        "--token", help="Bearer token (sinon BARREAU_PARIS_BEARER_TOKEN)."
    )
    parser.add_argument(
        "--nom", default="", help="Filtre par nom (mode ciblé, min 2 chars)."
    )
    parser.add_argument(
        "--act", type=int, default=None, help="Code activité (mode ciblé)."
    )
    parser.add_argument(
        "--spec", type=int, default=None, help="Code spécialité (mode ciblé)."
    )
    parser.add_argument(
        "--page-size", type=int, default=30, help="Résultats par page (défaut: 30)."
    )
    parser.add_argument(
        "--max-pages", type=int, default=0, help="Pages max par requête (0 = toutes)."
    )
    parser.add_argument(
        "--details",
        action="store_true",
        help="Enrichir Case et Date serment via GetAvocatByCnbf.",
    )
    parser.add_argument(
        "--list-criteria",
        action="store_true",
        help="Afficher les critères disponibles.",
    )
    parser.add_argument(
        "--criteria-output",
        default="",
        help="Sauvegarder les critères dans ce fichier JSON.",
    )
    parser.add_argument(
        "--output", default=DEFAULT_OUTPUT, help="Chemin du CSV de sortie."
    )
    return parser.parse_args()


# ──────────────────────────────────────────────────────────────────────────────
# Utilitaires
# ──────────────────────────────────────────────────────────────────────────────


def clean_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, bool):
        return str(value)
    if isinstance(value, (list, tuple, set)):
        return " | ".join(clean_value(v) for v in value if clean_value(v))
    if isinstance(value, dict):
        return " | ".join(clean_value(v) for v in value.values() if clean_value(v))
    return str(value).strip()


def join_list(value: Any) -> str:
    if isinstance(value, list):
        return " | ".join(str(v).strip() for v in value if str(v).strip())
    return clean_value(value)


def build_headers(token: str) -> dict:
    headers = dict(REQ_HEADERS)
    headers["Authorization"] = f"Bearer {token.strip()}"
    return headers


def get_records(data: Any) -> list:
    """Extrait les enregistrements depuis data['list']['exact'] + data['list']['contient']."""
    if isinstance(data, list):
        return data
    if not isinstance(data, dict):
        return []
    lst = data.get("list")
    if isinstance(lst, dict):
        exact = lst.get("exact", []) or []
        contient = lst.get("contient", []) or []
        return list(exact) + list(contient)
    for key in ("records", "data", "items", "response", "liste"):
        value = data.get(key)
        if isinstance(value, list):
            return value
    return []


def assemble_row(item: dict) -> dict:
    """Mappe un enregistrement API vers le format contacts BarOtech.

    Deux types d'entités coexistent dans le flux :
    - Structures (cabinets) : type_structure non vide → Structure(s) = nom
    - Avocats individuels   : type_structure vide    → Structure(s) = vide
    """
    nom = clean_value(item.get("nom", ""))
    type_structure = clean_value(item.get("type_structure", ""))
    adresse = clean_value(item.get("adresse_paris", "")) or clean_value(
        item.get("adresse_Etranger", "")
    )

    return {
        "ID Contact": clean_value(item.get("identifiant", "")),
        "Nom Complet": nom,
        "Barreau": "Barreau de Paris",
        "Téléphone(s)": join_list(item.get("telephone", [])),
        "Adresse(s)": adresse,
        "Email(s)": join_list(item.get("emails", [])),
        "Structure(s)": nom if type_structure else "",
        "Site Web": join_list(item.get("site_internet", [])),
    }


# ──────────────────────────────────────────────────────────────────────────────
# Appels API
# ──────────────────────────────────────────────────────────────────────────────


def fetch_page_raw(
    session: requests.Session,
    token: str,
    nom: str,
    act: Optional[int],
    spec: Optional[int],
    page: int,
    page_size: int,
) -> Tuple[list, int]:
    """Retourne (enregistrements, totalResult). Lève TokenExpiredError sur 401."""
    params: dict = {
        "page": page,
        "result": page_size,
        "nom": nom or "",
        "timestamp": str(int(time.time())),
    }
    if act is not None:
        params["act"] = act
    if spec is not None:
        params["spec"] = spec
    resp = session.get(
        SEARCH_URL, headers=build_headers(token), params=params, timeout=30
    )
    if resp.status_code == 401:
        raise TokenExpiredError(
            "Token expiré (401). Récupérez un nouveau token sur https://www.avocatparis.org/ "
            "et mettez à jour BARREAU_PARIS_BEARER_TOKEN dans .env, puis relancez."
        )
    resp.raise_for_status()
    data = resp.json()
    total = (
        data.get("metadata", {}).get("totalResult", 0) if isinstance(data, dict) else 0
    )
    return get_records(data), int(total)


class TokenExpiredError(Exception):
    pass


def fetch_all_pages(
    session: requests.Session,
    token: str,
    nom: str,
    act: Optional[int],
    spec: Optional[int],
    page_size: int,
    max_pages: int,
) -> Tuple[dict, int]:
    """Pagine jusqu'à épuisement. Retourne (rows_dict, total_result_API)."""
    rows: dict = {}
    page = 0
    total = 0
    while True:
        items, total = fetch_page_raw(session, token, nom, act, spec, page, page_size)
        if not items:
            break
        for item in items:
            if isinstance(item, dict):
                row = assemble_row(item)
                key = row["ID Contact"] or f"_nokey_{len(rows)}"
                rows[key] = row
        if max_pages and page + 1 >= max_pages:
            break
        page += 1
        time.sleep(0.05)
    return rows, total


# ──────────────────────────────────────────────────────────────────────────────
# Extraction par nom — itération sur bigrammes AA→ZZ
# ──────────────────────────────────────────────────────────────────────────────


def load_progress() -> set:
    """Charge l'ensemble des bigrammes/trigrammes déjà traités."""
    if not os.path.exists(PROGRESS_FILE):
        return set()
    with open(PROGRESS_FILE, encoding="utf-8") as f:
        return {line.strip() for line in f if line.strip()}


def mark_done(prefix: str) -> None:
    """Enregistre un préfixe comme traité."""
    with open(PROGRESS_FILE, "a", encoding="utf-8") as f:
        f.write(prefix + "\n")


def load_existing_csv(output: str) -> dict:
    """Charge le CSV existant pour reprendre là où on s'est arrêté."""
    if not os.path.exists(output):
        return {}
    rows: dict = {}
    with open(output, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f, delimiter=";")
        for row in reader:
            key = row.get("ID Contact") or f"_nokey_{len(rows)}"
            rows[key] = row
    return rows


def extract_by_name_prefixes(
    session: requests.Session,
    token: str,
    page_size: int,
    max_pages: int,
    all_rows: dict,
    output: str,
) -> None:
    """Itère sur les 676 bigrammes AA→ZZ avec reprise automatique.

    - Charge la progression depuis PROGRESS_FILE (bigrammes déjà traités)
    - Sauvegarde le CSV et la progression après chaque bigramme
    - Subdivise en trigrammes les bigrammes dépassant CAP_THRESHOLD résultats
    """
    bigrams = [a + b for a in LETTERS for b in LETTERS]
    done = load_progress()
    capped = []
    start = time.time()
    todo = [b for b in bigrams if b not in done]

    if len(done) > 0:
        print(f"  Reprise : {len(done)} bigrammes déjà traités, {len(todo)} restants.")
    print(
        f"  {len(bigrams)} bigrammes au total (seuil subdivision : {CAP_THRESHOLD})..."
    )

    for i, bigram in enumerate(todo, start=1):
        rows, total = fetch_all_pages(
            session, token, bigram, None, None, page_size, max_pages
        )
        before = len(all_rows)
        all_rows.update(rows)
        new = len(all_rows) - before

        if total >= CAP_THRESHOLD:
            capped.append(bigram)

        mark_done(bigram)
        save_csv(list(all_rows.values()), output, False)

        if i % 25 == 0 or new > 50:
            elapsed = time.time() - start
            rate = i / elapsed
            remaining = (len(todo) - i) / rate if rate > 0 else 0
            print(
                f"  [{i:3d}/{len(todo)}]  {bigram}  total={total:4d}  +{new:4d} nouveaux"
                f"  | corpus: {len(all_rows):6d}  ETA: ~{remaining / 60:.0f} min"
            )

    # Subdivision des bigrammes plafonnés (non encore subdivisés)
    capped_todo = [b for b in capped if f"_{b}_subdivided" not in done]
    if capped_todo:
        print(f"\n  {len(capped_todo)} bigrammes plafonnés → subdivision trigrammes...")
        for bigram in capped_todo:
            for letter in LETTERS:
                trigram = bigram + letter
                if trigram in done:
                    continue
                rows, _ = fetch_all_pages(
                    session, token, trigram, None, None, page_size, max_pages
                )
                before = len(all_rows)
                all_rows.update(rows)
                new = len(all_rows) - before
                mark_done(trigram)
                if new > 0:
                    print(f"    {trigram} : +{new} nouveaux  | corpus: {len(all_rows)}")
            mark_done(f"_{bigram}_subdivided")
            save_csv(list(all_rows.values()), output, False)


# ──────────────────────────────────────────────────────────────────────────────
# Extraction complète
# ──────────────────────────────────────────────────────────────────────────────


def load_or_fetch_criteria(session: requests.Session, token: str) -> Dict[str, Any]:
    """Charge criteria.json depuis le disque ou le récupère depuis l'API."""
    if os.path.exists(CRITERIA_FILE):
        with open(CRITERIA_FILE, encoding="utf-8") as f:
            return normalize_criteria(json.load(f))
    print("  Récupération des critères depuis l'API...")
    payload = fetch_criteria(session, token)
    criteria = normalize_criteria(payload)
    with open(CRITERIA_FILE, "w", encoding="utf-8") as f:
        json.dump(criteria, f, ensure_ascii=False, indent=2)
    print(f"  Critères sauvegardés : {CRITERIA_FILE}")
    return criteria


def extract_full(
    session: requests.Session, token: str, page_size: int, max_pages: int, output: str
) -> dict:
    # Reprise depuis le CSV existant
    all_rows = load_existing_csv(output)
    if all_rows:
        print(f"  Reprise : {len(all_rows)} contacts déjà dans le CSV.")

    done = load_progress()

    # 1. Flux sans filtre : non-exerçants + structures
    if "__no_filter__" not in done:
        print("\n[1/4] Flux sans filtre (non-exerçants + structures)...")
        rows, _ = fetch_all_pages(session, token, "", None, None, page_size, max_pages)
        before = len(all_rows)
        all_rows.update(rows)
        mark_done("__no_filter__")
        save_csv(list(all_rows.values()), output, False)
        print(f"      → {len(all_rows) - before} nouveaux  |  corpus : {len(all_rows)}")
    else:
        print("\n[1/4] Flux sans filtre : déjà traité.")

    # 2. Itération par bigrammes de noms
    print("\n[2/4] Extraction par bigrammes de noms (AA → ZZ)...")
    extract_by_name_prefixes(session, token, page_size, max_pages, all_rows, output)
    print(f"      corpus après bigrammes : {len(all_rows)}")

    # 3. Par spécialité
    criteria = load_or_fetch_criteria(session, token)
    specs = criteria.get("specialite", [])
    print(f"\n[3/4] Par spécialité ({len(specs)} codes)...")
    for s in specs:
        code = s.get("CODE")
        libelle = s.get("LIBELLE", "")
        key = f"__spec_{code}__"
        if key in done:
            continue
        rows, total = fetch_all_pages(
            session, token, "", None, code, page_size, max_pages
        )
        before = len(all_rows)
        all_rows.update(rows)
        new = len(all_rows) - before
        mark_done(key)
        save_csv(list(all_rows.values()), output, False)
        print(
            f"      spec {code:3}  {libelle[:45]:45s}  {total:4d} résultats  +{new} nouveaux"
        )

    # 4. Par activité
    acts = criteria.get("activite", [])
    print(f"\n[4/4] Par activité ({len(acts)} codes)...")
    for a in acts:
        code = a.get("CODE")
        libelle = a.get("LIBELLE", "")
        key = f"__act_{code}__"
        if key in done:
            continue
        rows, total = fetch_all_pages(
            session, token, "", code, None, page_size, max_pages
        )
        before = len(all_rows)
        all_rows.update(rows)
        new = len(all_rows) - before
        mark_done(key)
        save_csv(list(all_rows.values()), output, False)
        print(
            f"      act  {code:3}  {libelle[:45]:45s}  {total:4d} résultats  +{new} nouveaux"
        )

    return all_rows


# ──────────────────────────────────────────────────────────────────────────────
# Critères
# ──────────────────────────────────────────────────────────────────────────────


def fetch_criteria(session: requests.Session, token: str) -> Any:
    resp = session.get(CRITERIA_URL, headers=build_headers(token), timeout=30)
    resp.raise_for_status()
    return resp.json()


def normalize_criteria(payload: Any) -> Dict[str, Any]:
    keys = ("specialite", "activite", "mandat", "langue", "fonctions")
    if isinstance(payload, list) and payload and isinstance(payload[0], dict):
        src = payload[0]
    elif isinstance(payload, dict):
        src = payload
    else:
        return {k: [] for k in keys}
    return {k: src.get(k, []) for k in keys}


def print_criteria(criteria: Dict[str, Any], output_file: str = "") -> None:
    print("\n=== Critères disponibles ===")
    for key in ("specialite", "activite", "mandat", "langue", "fonctions"):
        values = criteria.get(key, [])
        print(f"\n{key.upper()} ({len(values)})")
        for item in values:
            if isinstance(item, dict):
                print(
                    f"  {item.get('CODE', '')} = {item.get('LIBELLE', item.get('label', ''))}"
                )
            else:
                print(f"  {item}")
    if output_file:
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(criteria, f, ensure_ascii=False, indent=2)
        print(f"Critères sauvegardés : {output_file}")


# ──────────────────────────────────────────────────────────────────────────────
# Enrichissement détails
# ──────────────────────────────────────────────────────────────────────────────


def lower_keys(obj: dict) -> dict:
    return {str(k).lower(): v for k, v in obj.items()}


def extract_field(item: dict, names: Iterable[str], default: str = "") -> str:
    lower = lower_keys(item)
    for name in names:
        value = lower.get(name.lower())
        if value is not None and clean_value(value):
            return clean_value(value)
    return default


def fetch_detail(session: requests.Session, token: str, cnbf: str) -> dict:
    resp = session.get(
        DETAIL_URL, headers=build_headers(token), params={"cnbf": cnbf}, timeout=30
    )
    resp.raise_for_status()
    return resp.json() if resp.text else {}


def enrich_with_details(rows: list, session: requests.Session, token: str) -> None:
    print(f"\n=== Enrichissement détails ({len(rows)} fiches) ===")
    for i, row in enumerate(rows, start=1):
        cnbf = row["ID Contact"]
        if not cnbf:
            continue
        try:
            detail = fetch_detail(session, token, cnbf)
        except Exception as exc:
            print(f"  ⚠️  {cnbf} : {exc}")
            continue
        lower = lower_keys(detail if isinstance(detail, dict) else {})
        row["Case"] = extract_field(lower, ["Case", "case", "specialite"], "")
        row["Date serment"] = extract_field(
            lower, ["DateSerment", "dateSerment", "date_de_serment", "date"], ""
        )
        if i % 50 == 0:
            print(f"  {i}/{len(rows)} détails traités...")


# ──────────────────────────────────────────────────────────────────────────────
# Sauvegarde
# ──────────────────────────────────────────────────────────────────────────────


def save_csv(rows: list, output: str, include_details: bool) -> None:
    os.makedirs(os.path.dirname(output), exist_ok=True)
    fieldnames = list(CSV_HEADER)
    if include_details:
        fieldnames += ["Case", "Date serment"]
    with open(output, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(
            f, fieldnames=fieldnames, delimiter=";", extrasaction="ignore"
        )
        writer.writeheader()
        writer.writerows(rows)
    print(f"\nCSV contacts : {output}  ({len(rows)} lignes)")


# ──────────────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────────────


def main() -> None:
    args = parse_args()
    token = args.token or os.environ.get(ENV_TOKEN)
    if not token:
        raise SystemExit(
            "Erreur : fournissez un bearer token via --token "
            f"ou la variable d'environnement {ENV_TOKEN}."
        )

    with requests.Session() as session:
        if args.list_criteria:
            try:
                payload = fetch_criteria(session, token)
            except Exception as exc:
                raise SystemExit(f"Erreur API critères : {exc}")
            print_criteria(normalize_criteria(payload), args.criteria_output)
            return

        # Mode ciblé : au moins un filtre explicite
        targeted = args.spec is not None or args.act is not None or args.nom
        if targeted:
            label = f"nom={args.nom!r}  spec={args.spec}  act={args.act}"
            print(f"Mode ciblé : {label}")
            try:
                all_rows, _ = fetch_all_pages(
                    session,
                    token,
                    args.nom,
                    args.act,
                    args.spec,
                    args.page_size,
                    args.max_pages,
                )
            except TokenExpiredError as exc:
                raise SystemExit(f"\n⚠️  {exc}")
            except Exception as exc:
                raise SystemExit(f"Erreur API : {exc}")
        else:
            print("Mode complet : extraction exhaustive par bigrammes de noms.")
            try:
                all_rows = extract_full(
                    session, token, args.page_size, args.max_pages, args.output
                )
            except TokenExpiredError as exc:
                raise SystemExit(f"\n⚠️  {exc}")
            except Exception as exc:
                raise SystemExit(f"Erreur API : {exc}")

        rows = list(all_rows.values())
        if not rows:
            print("Aucun enregistrement trouvé.")
            return

        print(f"\nTotal unique : {len(rows)} enregistrements.")

        if args.details:
            enrich_with_details(rows, session, token)

        save_csv(rows, args.output, args.details)

        # Nettoyage du fichier de progression une fois l'extraction complète
        if not targeted and os.path.exists(PROGRESS_FILE):
            os.remove(PROGRESS_FILE)
            print("Progression nettoyée.")


if __name__ == "__main__":
    main()
