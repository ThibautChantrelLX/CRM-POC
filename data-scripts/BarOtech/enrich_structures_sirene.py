import csv
import os
import time
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
import datetime

_DIR = os.path.dirname(os.path.abspath(__file__))
_DATE = os.environ.get("EXTRACTION_DATE", datetime.date.today().strftime("%Y-%m-%d"))
INPUT_CSV = os.path.join(_DIR, f"{_DATE}_extraction_barotech_specialities_activites.csv")
OUTPUT_CSV = os.path.join(_DIR, f"{_DATE}_extraction_structures_sirene.csv")
PROGRESS = os.path.join(_DIR, f".{_DATE}_sirene_progress.csv")

SIRENE_URL = "https://recherche-entreprises.api.gouv.fr/search"
MAX_WORKERS = 5  # API publique : rester raisonnable
SOURCE = "BAROTECH+SIRENE"

CSV_HEADERS = [
    "raison_sociale",
    "siret",
    "siren",
    "type_structure",  # forme juridique libellé
    "categorie_entrepri",  # catégorie juridique code
    "secteur_activite",  # code NAF + libellé
    "site_web",
    "source_origine",
    "rue",
    "complement_adres",
    "code_postal",
    "ville",
    "pays",
    "sirene_trouve",  # booléen qualité de match
]


def search_sirene(nom):
    try:
        resp = requests.get(SIRENE_URL, params={"q": nom, "per_page": 1}, timeout=10)
        if resp.status_code != 200:
            return None
        results = resp.json().get("results", [])
        if not results:
            return None
        return results[0]
    except Exception:
        return None


def extract_fields(nom, data):
    if not data:
        return {
            "raison_sociale": nom,
            "siret": "",
            "siren": "",
            "type_structure": "",
            "categorie_entrepri": "",
            "secteur_activite": "",
            "site_web": "",
            "source_origine": SOURCE,
            "rue": "",
            "complement_adres": "",
            "code_postal": "",
            "ville": "",
            "pays": "France",
            "sirene_trouve": "non",
        }

    siege = data.get("siege") or {}

    # Adresse : reconstruire depuis les composants si disponibles
    numero = siege.get("numero_voie") or ""
    type_v = siege.get("type_voie") or ""
    libelle_v = siege.get("libelle_voie") or ""
    rue_parts = [p for p in [numero, type_v, libelle_v] if p]
    rue = " ".join(rue_parts) if rue_parts else (siege.get("adresse") or "")

    # NAF : code + libellé
    naf_code = data.get("activite_principale") or ""
    naf_label = data.get("libelle_activite_principale") or ""
    secteur = f"{naf_code} - {naf_label}" if naf_code and naf_label else naf_code

    return {
        "raison_sociale": data.get("nom_complet")
        or data.get("nom_raison_sociale")
        or nom,
        "siret": siege.get("siret") or "",
        "siren": data.get("siren") or "",
        "type_structure": data.get("forme_juridique") or "",
        "categorie_entrepri": data.get("nature_juridique") or "",
        "secteur_activite": secteur,
        "site_web": "",
        "source_origine": SOURCE,
        "rue": rue,
        "complement_adres": siege.get("complement_adresse") or "",
        "code_postal": siege.get("code_postal") or "",
        "ville": siege.get("libelle_commune") or "",
        "pays": "France",
        "sirene_trouve": "oui",
    }


def main():
    # 1. Extraire les structures uniques du CSV
    with open(INPUT_CSV, encoding="utf-8-sig") as f:
        rows = list(csv.reader(f, delimiter=";"))

    header = rows[0]
    struct_idx = header.index("Structure(s)")

    structures = set()
    for row in rows[1:]:
        if len(row) > struct_idx and row[struct_idx]:
            for s in row[struct_idx].split(" | "):
                s = s.strip()
                if s:
                    structures.add(s)

    print(f"{len(structures)} structures uniques à enrichir.")

    # 2. Charger la progression existante
    done = {}
    if os.path.exists(PROGRESS):
        with open(PROGRESS, encoding="utf-8") as f:
            reader = csv.DictReader(f, delimiter=";")
            for row in reader:
                done[row["raison_sociale_input"]] = row
        print(f"Reprise : {len(done)} structures déjà traitées.")

    todo = [s for s in structures if s not in done]
    print(f"À traiter : {len(todo)}")

    # 3. Enrichir via SIRENE
    progress_file = open(PROGRESS, "a", encoding="utf-8", newline="")
    progress_writer = None

    processed = 0
    start = time.time()

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(search_sirene, nom): nom for nom in todo}
        for future in as_completed(futures):
            nom = futures[future]
            data = future.result()
            row = extract_fields(nom, data)
            row["raison_sociale_input"] = nom  # clé de déduplication

            if progress_writer is None:
                progress_writer = csv.DictWriter(
                    progress_file, fieldnames=list(row.keys()), delimiter=";"
                )
                if os.path.getsize(PROGRESS) == 0 or len(done) == 0:
                    progress_writer.writeheader()

            progress_writer.writerow(row)
            progress_file.flush()
            done[nom] = row
            processed += 1

            if processed % 200 == 0:
                elapsed = time.time() - start
                rate = processed / elapsed
                remaining = (len(todo) - processed) / rate if rate > 0 else 0
                found = sum(1 for r in done.values() if r.get("sirene_trouve") == "oui")
                print(
                    f"  {processed:5d}/{len(todo)} | {rate:.1f} req/s | ~{remaining / 60:.0f} min | trouvés: {found}"
                )

    progress_file.close()

    # 4. Écrire le CSV final
    with open(OUTPUT_CSV, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(
            f, fieldnames=CSV_HEADERS, delimiter=";", extrasaction="ignore"
        )
        writer.writeheader()
        for row in done.values():
            writer.writerow(row)

    found = sum(1 for r in done.values() if r.get("sirene_trouve") == "oui")
    print(
        f"\nTerminé : {len(done)} structures, {found} trouvées sur SIRENE ({found * 100 // len(done)}%)"
    )
    print(f"CSV : {OUTPUT_CSV}")

    if os.path.exists(PROGRESS):
        os.remove(PROGRESS)


if __name__ == "__main__":
    main()
