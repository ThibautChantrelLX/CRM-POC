import requests
import csv
import os
import argparse
import datetime

URL_PORTAIL = "https://portail.barotech.fr/_services/entity-grid-data.json/aa9a2081-0315-4c2f-8055-d2d74cbbc0c8"





ACTIVITES = {
    0: "Contentieux, médiation, arbitrage",
    1: "Dommages corporels et matériels",
    2: "Droit de la circulation et des transports",
    3: "Droit de la consommation",
    4: "Droit de la faillite et du surendettement",
    5: "Droit de la famille",
    6: "Droit de la sécurité sociale",
    7: "Droit de l'environnement",
    8: "Droit de l'homme et libertés publiques",
    9: "Droit de l'immigration et d'asile",
    10: "Droit de l'UE",
    11: "Droit de succession",
    12: "Droit des affaires",
    13: "Droit des biens",
    14: "Droit des technologies de l'information",
    15: "Droit du travail",
    16: "Droit fiscal",
    17: "Droit pénal",
    18: "Droit public",
    19: "Propriété intellectuelle",
}

_DIR = os.path.dirname(os.path.abspath(__file__))
_OUT_DIR = os.path.join(os.path.dirname(_DIR), "output", "BarOtech")
os.makedirs(_OUT_DIR, exist_ok=True)
_DATE = os.environ.get("EXTRACTION_DATE", datetime.date.today().strftime("%Y-%m-%d"))
INPUT_CSV = os.path.join(_OUT_DIR, f"{_DATE}_extraction_barotech.csv")
OUTPUT_CSV = INPUT_CSV


def fetch_ids_for_activite(filter_value, req_headers, base64_config):
    ids = set()
    paging_cookie = ""
    page = 1
    while True:
        payload = {
            "base64SecureConfiguration": base64_config,
            "sortExpression": "fullname ASC",
            "search": "",
            "page": page,
            "pageSize": 100,
            "pagingCookie": paging_cookie,
            "filter": None,
            "metaFilter": f"0=&1=&2=&3=&5={filter_value}",
            "timezoneOffset": -120,
            "customParameters": [],
        }
        resp = requests.post(URL_PORTAIL, headers=req_headers, json=payload)
        if resp.status_code != 200:
            print(f"    Erreur {resp.status_code}")
            break
        data = resp.json()
        records = data.get("Records", [])
        for r in records:
            ids.add(r.get("Id", ""))
        if not data.get("MoreRecords"):
            break
        paging_cookie = data.get("NextPagePagingCookie", "")
        page += 1
    return ids


def main():
    parser = argparse.ArgumentParser(description="Enrichissement activités Barotech")
    parser.add_argument("--cookie", default=os.environ.get("BAROTECH_COOKIE", ""))
    parser.add_argument("--token", default=os.environ.get("BAROTECH_TOKEN", ""))
    parser.add_argument("--base64", dest="base64_config", default=os.environ.get("BAROTECH_BASE64", ""))
    args = parser.parse_args()
    cookie = args.cookie
    token = args.token
    base64_config = args.base64_config
    if not cookie:
        raise SystemExit("❌  Cookie manquant — utilise --cookie ou BAROTECH_COOKIE")
    if not token:
        raise SystemExit("❌  Token manquant — utilise --token ou BAROTECH_TOKEN")
    if not base64_config:
        raise SystemExit("❌  Base64 manquant — utilise --base64 ou BAROTECH_BASE64")

    req_headers = {
        "__requestverificationtoken": token,
        "cookie": cookie,
        "content-type": "application/json; charset=UTF-8",
        "accept": "application/json, text/javascript, */*; q=0.01",
        "accept-language": "en-US,en;q=0.9,fr-FR;q=0.8,fr;q=0.7",
        "origin": "https://portail.barotech.fr",
        "referer": "https://portail.barotech.fr/annuaire/",
        "x-requested-with": "XMLHttpRequest",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    }

    # Étape 1 : récupérer les IDs par activité dominante
    id_to_activites = {}

    for filter_val, label in ACTIVITES.items():
        print(f"[{filter_val:2d}/19] {label}...")
        ids = fetch_ids_for_activite(filter_val, req_headers, base64_config)
        print(f"        -> {len(ids)} avocats")
        for contact_id in ids:
            if contact_id not in id_to_activites:
                id_to_activites[contact_id] = []
            id_to_activites[contact_id].append(label)

    print(f"\n{len(id_to_activites)} avocats ont au moins une activité dominante.")

    # Étape 2 : enrichir le CSV existant
    with open(INPUT_CSV, encoding="utf-8-sig") as f:
        reader = csv.reader(f, delimiter=";")
        rows = list(reader)

    header_row = rows[0]
    if "Activité(s) dominante(s)" not in header_row:
        header_row.append("Activité(s) dominante(s)")

    col_index = header_row.index("Activité(s) dominante(s)")

    for row in rows[1:]:
        contact_id = row[0] if row else ""
        activites = id_to_activites.get(contact_id, [])
        while len(row) <= col_index:
            row.append("")
        row[col_index] = " | ".join(activites)

    with open(OUTPUT_CSV, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f, delimiter=";")
        writer.writerows(rows)

    print(f"CSV mis à jour : {OUTPUT_CSV}")


if __name__ == "__main__":
    main()
