import requests
import csv
import os
import argparse
import datetime

URL_PORTAIL = "https://portail.barotech.fr/_services/entity-grid-data.json/aa9a2081-0315-4c2f-8055-d2d74cbbc0c8"





SPECIALITES = {
    0: "Droit bancaire et boursier",
    1: "Droit commercial, des affaires et de la concurrence",
    2: "Droit de la famille, des personnes et de leur patrimoine",
    3: "Droit de la fiducie",
    4: "Droit de la propriété intellectuelle",
    5: "Droit de la santé",
    6: "Droit de la sécurité sociale et de la protection sociale",
    7: "Droit de l'arbitrage",
    8: "Droit de l'environnement",
    9: "Droit des associations et des fondations",
    10: "Droit des associations et des fondations (2)",
    11: "Droit des assurances",
    12: "Droit des étrangers et de la nationalité",
    13: "Droit des garanties, des sûretés et des mesures d'exécution",
    14: "Droit des nouvelles technologies, de l'information et de la communication (NTIC)",
    15: "Droit des sociétés",
    16: "Droit des transports",
    17: "Droit du crédit et de la consommation",
    18: "Droit du dommage corporel",
    19: "Droit du sport",
    20: "Droit du travail",
    21: "Droit fiscal et droit douanier",
    22: "Droit immobilier",
    23: "Droit international et de l'union européenne",
    24: "Droit pénal",
    25: "Droit public",
    26: "Droit rural",
    27: "Procédure d'Appel",
}

_DIR = os.path.dirname(os.path.abspath(__file__))
_OUT_DIR = os.path.join(os.path.dirname(_DIR), "output", "BarOtech")
os.makedirs(_OUT_DIR, exist_ok=True)
_DATE = os.environ.get("EXTRACTION_DATE", datetime.date.today().strftime("%Y-%m-%d"))
INPUT_CSV = os.path.join(_OUT_DIR, f"{_DATE}_extraction_barotech.csv")
OUTPUT_CSV = INPUT_CSV


def fetch_ids_for_specialite(filter_value, req_headers, base64_config):
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
            "metaFilter": f"0=&1=&2=&3=&4={filter_value}",
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
    parser = argparse.ArgumentParser(description="Enrichissement spécialités Barotech")
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

    # Étape 1 : récupérer les IDs par spécialité
    id_to_specialites = {}

    for filter_val, label in SPECIALITES.items():
        print(f"[{filter_val:2d}/27] {label}...")
        ids = fetch_ids_for_specialite(filter_val, req_headers, base64_config)
        print(f"        -> {len(ids)} avocats")
        for contact_id in ids:
            if contact_id not in id_to_specialites:
                id_to_specialites[contact_id] = []
            id_to_specialites[contact_id].append(label)

    print(f"\n{len(id_to_specialites)} avocats ont au moins une spécialité.")

    # Étape 2 : enrichir le CSV existant
    with open(INPUT_CSV, encoding="utf-8-sig") as f:
        reader = csv.reader(f, delimiter=";")
        rows = list(reader)

    header_row = rows[0]
    if "Spécialité(s)" not in header_row:
        header_row.append("Spécialité(s)")

    for row in rows[1:]:
        contact_id = row[0] if row else ""
        specialites = id_to_specialites.get(contact_id, [])
        if len(row) < len(header_row):
            row.append(" | ".join(specialites))
        else:
            row[-1] = " | ".join(specialites)

    with open(OUTPUT_CSV, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f, delimiter=";")
        writer.writerows(rows)

    print(f"CSV mis à jour : {OUTPUT_CSV}")


if __name__ == "__main__":
    main()
