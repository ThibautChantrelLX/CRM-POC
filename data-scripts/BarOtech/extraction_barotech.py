import requests
import csv
import argparse
import os
import datetime

URL_PORTAIL = "https://portail.barotech.fr/_services/entity-grid-data.json/aa9a2081-0315-4c2f-8055-d2d74cbbc0c8"


_DIR = os.path.dirname(os.path.abspath(__file__))
_DATE = os.environ.get("EXTRACTION_DATE", datetime.date.today().strftime("%Y-%m-%d"))
OUTPUT_FILE = os.path.join(_DIR, f"{_DATE}_extraction_barotech.csv")


def get_attr(record, name):
    for attr in record.get("Attributes", []):
        if attr.get("Name") == name:
            v = attr.get("Value") or ""
            return v if not isinstance(v, dict) else ""
    return ""


def get_attr_name(record, name):
    for attr in record.get("Attributes", []):
        if attr.get("Name") == name:
            v = attr.get("Value")
            if isinstance(v, dict):
                return v.get("Name", "")
    return ""


def clean_field(value):
    if not value or value == "@#":
        return ""
    parts = [p.strip() for p in str(value).split("@#") if p.strip()]
    return " | ".join(parts)


def main():
    parser = argparse.ArgumentParser(description="Extraction Barotech")
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
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
    }

    all_records = []
    paging_cookie = ""
    page = 1

    print("📡 Connexion au portail Barotech...")

    while True:
        payload = {
            "base64SecureConfiguration": base64_config,
            "sortExpression": "fullname ASC",
            "search": "",
            "page": page,
            "pageSize": 100,
            "pagingCookie": paging_cookie,
            "filter": None,
            "metaFilter": "0=&1=&2=&3=",
            "timezoneOffset": -120,
            "customParameters": [],
        }

        resp = requests.post(URL_PORTAIL, headers=req_headers, json=payload)

        if resp.status_code != 200:
            print(f"❌ Erreur {resp.status_code} à la page {page}")
            print(resp.text[:500])
            break

        try:
            data = resp.json()
        except Exception:
            print("❌ Réponse non JSON :")
            print(resp.text[:1000])
            break

        records = data.get("Records", [])
        if not records:
            break

        all_records.extend(records)
        total = data.get("ItemCount", "?")
        print(
            f"Page {page:4d} | +{len(records):3d} | Total: {len(all_records):6d}/{total}"
        )

        if not data.get("MoreRecords"):
            break

        paging_cookie = data.get("NextPagePagingCookie", "")
        page += 1

    print(f"\n✅ Terminé ! {len(all_records)} avocats récupérés.")

    if not all_records:
        return

    with open(OUTPUT_FILE, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f, delimiter=";")
        writer.writerow(
            [
                "ID Contact",
                "Nom Complet",
                "Barreau",
                "Téléphone(s)",
                "Adresse(s)",
                "Email(s)",
                "Structure(s)",
                "Site Web",
            ]
        )
        for r in all_records:
            writer.writerow(
                [
                    r.get("Id", ""),
                    get_attr(r, "fullname"),
                    get_attr_name(r, "owningbusinessunit"),
                    clean_field(get_attr(r, "isa_telephoneannuaire")),
                    clean_field(get_attr(r, "isa_adresseannuaire")),
                    clean_field(get_attr(r, "isa_emailannuaire")),
                    clean_field(get_attr(r, "isa_structureannuaire")),
                    clean_field(get_attr(r, "isa_sitewebannuaire")),
                ]
            )

    print(f"🎉 Données sauvegardées dans '{OUTPUT_FILE}'.")


if __name__ == "__main__":
    main()
