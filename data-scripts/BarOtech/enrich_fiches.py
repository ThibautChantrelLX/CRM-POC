import requests
import csv
import os
import argparse
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
import datetime

URL_PORTAIL = "https://portail.barotech.fr/_services/entity-grid-data.json/aa9a2081-0315-4c2f-8055-d2d74cbbc0c8"





_DIR = os.path.dirname(os.path.abspath(__file__))
_OUT_DIR = os.path.join(os.path.dirname(_DIR), "output", "BarOtech")
os.makedirs(_OUT_DIR, exist_ok=True)
_DATE = os.environ.get("EXTRACTION_DATE", datetime.date.today().strftime("%Y-%m-%d"))
INPUT_CSV = os.path.join(_OUT_DIR, f"{_DATE}_extraction_barotech.csv")
OUTPUT_CSV = INPUT_CSV
PROGRESS = os.path.join(_OUT_DIR, f".{_DATE}_enrich_fiches_progress.csv")

BASE_URL = "https://portail.barotech.fr/annuaire/avocat/?id="
MAX_WORKERS = 15
BATCH_SIZE = 500


def decode_html(s):
    return re.sub(r"&#(\d+);", lambda m: chr(int(m.group(1))), s).strip()


def parse_date(raw):
    if not raw:
        return ""
    try:
        return datetime.datetime.fromisoformat(raw[:10]).strftime("%d/%m/%Y")
    except Exception:
        return raw[:10]


def fetch_fiche(contact_id, req_headers):
    if not contact_id:
        return contact_id, "", ""
    try:
        resp = requests.get(BASE_URL + contact_id, headers=req_headers, timeout=15)
        if resp.status_code != 200:
            return contact_id, "", ""
        html = resp.text

        def extract(field_id):
            m = re.search(rf'id="{re.escape(field_id)}"[^>]+value="([^"]*)"', html)
            if not m:
                m = re.search(rf'value="([^"]*)"[^>]+id="{re.escape(field_id)}"', html)
            return decode_html(m.group(1)) if m else ""

        case = extract("isa_case")
        date = parse_date(extract("isa_date_de_prestation_de_serment"))
        return contact_id, case, date
    except Exception:
        return contact_id, "", ""


def main():
    parser = argparse.ArgumentParser(description="Enrichissement fiches Barotech")
    parser.add_argument("--cookie", default=os.environ.get("BAROTECH_COOKIE", ""))
    args = parser.parse_args()
    cookie = args.cookie
    if not cookie:
        raise SystemExit("❌  Cookie manquant — utilise --cookie ou BAROTECH_COOKIE")

    req_headers = {
        "cookie": cookie,
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "referer": "https://portail.barotech.fr/annuaire/",
        "accept": "text/html,application/xhtml+xml,*/*;q=0.8",
    }

    # Charger le CSV
    with open(INPUT_CSV, encoding="utf-8-sig") as f:
        rows = list(csv.reader(f, delimiter=";"))

    header_row = rows[0]
    data_rows = rows[1:]

    # Ajouter colonnes si absentes
    for col in ["Case", "Date serment"]:
        if col not in header_row:
            header_row.append(col)
    case_idx = header_row.index("Case")
    date_idx = header_row.index("Date serment")

    # Étendre toutes les lignes à la bonne longueur
    for row in data_rows:
        while len(row) < len(header_row):
            row.append("")

    # Charger la progression existante
    done = {}
    if os.path.exists(PROGRESS):
        with open(PROGRESS, encoding="utf-8") as f:
            for line in f:
                parts = line.strip().split(";")
                if len(parts) == 3:
                    done[parts[0]] = (parts[1], parts[2])
        print(f"Reprise : {len(done)} fiches déjà traitées.")

    # Identifier les lignes à traiter
    todo = [
        (i, row[0]) for i, row in enumerate(data_rows) if row[0] and row[0] not in done
    ]

    print(f"À traiter : {len(todo)} fiches ({len(done)} déjà faites)")

    # Appliquer les résultats déjà en cache
    for i, row in enumerate(data_rows):
        if row[0] in done:
            row[case_idx], row[date_idx] = done[row[0]]

    # Traitement par batch avec threads
    progress_file = open(PROGRESS, "a", encoding="utf-8")
    processed = 0
    start = time.time()

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(fetch_fiche, cid, req_headers): (i, cid) for i, cid in todo}
        for future in as_completed(futures):
            i, cid = futures[future]
            contact_id, case, date = future.result()
            data_rows[i][case_idx] = case
            data_rows[i][date_idx] = date
            done[contact_id] = (case, date)
            progress_file.write(f"{contact_id};{case};{date}\n")
            progress_file.flush()
            processed += 1

            if processed % 100 == 0:
                elapsed = time.time() - start
                rate = processed / elapsed
                remaining = (len(todo) - processed) / rate if rate > 0 else 0
                print(
                    f"  {processed:5d}/{len(todo)} | {rate:.1f} req/s | ~{remaining / 60:.0f} min restantes"
                )

    progress_file.close()

    # Sauvegarder le CSV mis à jour
    with open(OUTPUT_CSV, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f, delimiter=";")
        writer.writerow(header_row)
        writer.writerows(data_rows)

    print(f"\nTerminé. CSV mis à jour : {OUTPUT_CSV}")
    if os.path.exists(PROGRESS):
        os.remove(PROGRESS)


if __name__ == "__main__":
    main()
