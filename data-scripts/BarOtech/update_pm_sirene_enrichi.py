"""
=============================================================================
MISE À JOUR PM — extraction_structures_sirene_enrichi.csv
=============================================================================
Met à jour les champs enrichis (SIRET/SIREN, type_structure, catégorie,
secteur, adresse) sur les PersonnesMorales déjà importées depuis BarOtech.

Stratégie :
  - Lookup PM via mapping_sources (source_nom='BarOtech', source_id_externe=raison_sociale)
  - Ne remplace un champ que si la nouvelle valeur est non-vide et différente
  - Adresse : UPDATE sur place si la PM en a déjà une, CREATE sinon
  - source_origine : passe à 'BAROTECH+SIRENE' si un SIRET/SIREN est trouvé

Exécution :
    uv run python update_pm_sirene_enrichi.py          # base TEST (défaut)
    uv run python update_pm_sirene_enrichi.py --dev    # base DEV
=============================================================================
"""

import argparse
import csv
import logging
import os
import sys

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
os.makedirs(OUTPUT_DIR, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(os.path.join(OUTPUT_DIR, "update_pm_sirene_enrichi.log")),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger(__name__)


def _resolve_database_url() -> str:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--dev", action="store_true")
    args, _ = parser.parse_known_args()
    if args.dev:
        url = os.environ["DATABASE_URL"]
        logger.info("⚠️  Mode DEV — base de développement")
    else:
        url = os.environ["TEST_DATABASE_URL"]
        logger.info("ℹ️  Mode TEST (défaut) — base de test")
    return url


DATABASE_URL = _resolve_database_url()
CSV_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "data",
    "barotech",
    "extraction_structures_sirene_enrichi.csv",
)


def safe(val) -> str:
    return str(val).strip() if val else ""


def load_csv(path: str) -> list[dict]:
    with open(path, encoding="utf-8-sig") as f:
        return list(csv.DictReader(f, delimiter=";"))


def run():
    rows = load_csv(CSV_PATH)
    logger.info(f"{len(rows)} lignes chargées depuis {os.path.basename(CSV_PATH)}")

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    stats = {
        "pm_mises_a_jour": 0,
        "adresses_mises_a_jour": 0,
        "adresses_creees": 0,
        "non_trouvees": 0,
        "inchangees": 0,
        "erreurs": [],
    }

    for row in rows:
        rs = safe(row.get("raison_sociale"))
        if not rs:
            continue

        cur.execute("SAVEPOINT upd")
        try:
            # Lookup PM via mapping_sources
            cur.execute(
                """
                SELECT pm.id, pm.siret_siren, pm.type_structure,
                       pm.categorie_entreprise, pm.secteur_activite,
                       pm.source_origine, pm.adresse_id
                FROM personnes_morales pm
                JOIN mapping_sources ms
                  ON ms.entite_crm = 'PersonneMorale'
                 AND ms.entite_crm_id = pm.id
                 AND ms.source_nom = 'BarOtech'
                 AND ms.source_id_externe = %s
            """,
                (rs[:100],),
            )
            pm = cur.fetchone()

            if not pm:
                stats["non_trouvees"] += 1
                cur.execute("RELEASE SAVEPOINT upd")
                continue

            pm_id = pm["id"]

            # Champs scalaires à mettre à jour
            siret = safe(row.get("siret"))
            siren = safe(row.get("siren"))
            siret_siren_new = siret or siren or None

            updates: dict = {}

            if siret_siren_new and siret_siren_new != safe(pm["siret_siren"]):
                updates["siret_siren"] = siret_siren_new

            for csv_col, db_col in [
                ("type_structure", "type_structure"),
                ("categorie_entrepri", "categorie_entreprise"),
                ("secteur_activite", "secteur_activite"),
            ]:
                v = safe(row.get(csv_col))
                if v and v != safe(pm[db_col]):
                    updates[db_col] = v

            # source_origine : upgrade vers BAROTECH+SIRENE si on a trouvé un SIRET/SIREN
            if siret_siren_new and safe(pm["source_origine"]) == "BAROTECH":
                updates["source_origine"] = "BAROTECH+SIRENE"

            # Adresse
            rue = safe(row.get("rue")) or None
            cp = safe(row.get("code_postal")) or None
            ville = safe(row.get("ville")) or None
            complement = safe(row.get("complement_adres")) or None
            pays = safe(row.get("pays")) or "France"

            has_addr_data = any([rue, cp, ville])

            if has_addr_data:
                if pm["adresse_id"]:
                    # Mettre à jour l'adresse existante (uniquement les champs non-vides)
                    addr_sets = []
                    addr_vals = []
                    for col, val in [
                        ("rue", rue),
                        ("complement_adresse", complement),
                        ("code_postal", cp),
                        ("ville", ville),
                        ("pays", pays),
                    ]:
                        if val:
                            addr_sets.append(f"{col} = %s")
                            addr_vals.append(val)
                    if addr_sets:
                        addr_vals.append(pm["adresse_id"])
                        cur.execute(
                            f"UPDATE adresses SET {', '.join(addr_sets)}, modifier_le = NOW() WHERE id = %s",
                            addr_vals,
                        )
                        stats["adresses_mises_a_jour"] += 1
                else:
                    # Créer une adresse
                    cur.execute(
                        """
                        INSERT INTO adresses (rue, complement_adresse, code_postal, ville, pays, type_adresse, modifier_le)
                        VALUES (%s, %s, %s, %s, %s, 'SIEGE', NOW())
                        RETURNING id
                    """,
                        (rue, complement, cp, ville, pays),
                    )
                    new_addr_id = cur.fetchone()["id"]
                    updates["adresse_id"] = new_addr_id
                    stats["adresses_creees"] += 1

            # Appliquer les mises à jour PM
            if updates:
                set_clause = ", ".join(f"{col} = %s" for col in updates)
                values = list(updates.values()) + [pm_id]
                cur.execute(
                    f"UPDATE personnes_morales SET {set_clause}, modifier_le = NOW() WHERE id = %s",
                    values,
                )
                stats["pm_mises_a_jour"] += 1
            else:
                stats["inchangees"] += 1

            cur.execute("RELEASE SAVEPOINT upd")

        except Exception as e:
            cur.execute("ROLLBACK TO SAVEPOINT upd")
            msg = f"Erreur PM {rs!r}: {e}"
            logger.error(f"✗ {msg}")
            stats["erreurs"].append(msg)

    conn.commit()
    cur.close()
    conn.close()

    logger.info("=" * 60)
    logger.info("RAPPORT")
    logger.info("=" * 60)
    logger.info(f"  PM mises à jour      : {stats['pm_mises_a_jour']}")
    logger.info(f"  PM inchangées        : {stats['inchangees']}")
    logger.info(f"  PM non trouvées      : {stats['non_trouvees']}")
    logger.info(f"  Adresses mises à jour: {stats['adresses_mises_a_jour']}")
    logger.info(f"  Adresses créées      : {stats['adresses_creees']}")
    if stats["erreurs"]:
        logger.warning(f"  Erreurs              : {len(stats['erreurs'])}")
        for e in stats["erreurs"][:20]:
            logger.warning(f"    - {e}")
    logger.info("=" * 60)


if __name__ == "__main__":
    run()
