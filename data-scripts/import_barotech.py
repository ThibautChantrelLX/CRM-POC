"""
=============================================================================
IMPORT BAROTECH → CRM LX
=============================================================================
Sources :
  - data/barotech/extraction_barotech_specialities_activites.csv  (PP)
  - data/barotech/extraction_structures_sirene.csv                (PM)

Exécution :
    uv run python import_barotech.py          # base de TEST (défaut)
    uv run python import_barotech.py --dev    # base de DEV

Logique :
  1. PM   — créées depuis le fichier structures_sirene.
             source_origine = 'BAROTECH+SIRENE' (avec SIRET) ou 'BAROTECH'
             (cabinets individuels sans SIRET).
             mapping_sources.source_nom = 'BarOtech' pour les deux.
             source_id_externe = raison_sociale (unique dans barotech).

  2. PP   — créées depuis le fichier barotech_specialities_activites.
             mapping_sources.source_nom = 'BarOtech',
             source_id_externe = ID Contact (UUID barotech).

  3. Rattachements PP ↔ PM :
             date_debut = date_serment du PP (NOW() si absent).
             date_fin   = NULL.

  4. nomDomaine PM — alimenté depuis les emails pro des PP membres.
=============================================================================
"""

import argparse
import csv
import logging
import os
import re
import sys
from collections import defaultdict
from datetime import date, datetime
from typing import Optional

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()

# =============================================================================
# LOGGING
# =============================================================================
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
os.makedirs(OUTPUT_DIR, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(os.path.join(OUTPUT_DIR, "import_barotech.log")),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger(__name__)

# =============================================================================
# CONFIGURATION
# =============================================================================


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

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(_SCRIPT_DIR, "data", "barotech")
CSV_PP = os.path.join(DATA_DIR, "extraction_barotech_specialities_activites.csv")
CSV_PM = os.path.join(DATA_DIR, "extraction_structures_sirene_enrichi.csv")

SOURCE_NOM = "BarOtech"

# Domaines email génériques à exclure du nomDomaine
_DOMAINES_GENERIQUES = {
    "gmail.com",
    "googlemail.com",
    "yahoo.com",
    "yahoo.fr",
    "ymail.com",
    "hotmail.com",
    "hotmail.fr",
    "outlook.com",
    "outlook.fr",
    "live.com",
    "live.fr",
    "msn.com",
    "orange.fr",
    "wanadoo.fr",
    "wanadoo.com",
    "free.fr",
    "sfr.fr",
    "neuf.fr",
    "numericable.fr",
    "laposte.net",
    "bbox.fr",
    "icloud.com",
    "me.com",
    "mac.com",
    "aol.com",
    "aol.fr",
    "protonmail.com",
    "proton.me",
    "tutanota.com",
    "gmx.com",
    "gmx.fr",
    # domaines avocat génériques
    "avocat.fr",
    "avocats.fr",
}

# =============================================================================
# UTILITAIRES
# =============================================================================


def safe_str(val) -> str:
    if val is None:
        return ""
    return str(val).strip()


def split_pipe(val: str) -> list[str]:
    """Sépare une valeur multi-entrées séparée par '|'."""
    return [s.strip() for s in val.split("|") if s.strip()]


def normalize_email(val: str) -> str:
    s = safe_str(val).lower()
    return s if "@" in s else ""


def domain_from_email(val: str) -> Optional[str]:
    s = normalize_email(val)
    if not s:
        return None
    domain = s.split("@")[1].lower()
    return None if domain in _DOMAINES_GENERIQUES else domain


def parse_date(val: str) -> Optional[date]:
    s = safe_str(val)
    if not s:
        return None
    for fmt in ("%d/%m/%Y", "%d/%m/%y", "%Y-%m-%d", "%m/%d/%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    logger.warning(f"Format de date non reconnu : {s!r}")
    return None


def parse_nom_prenom(nom_complet: str) -> tuple[str, Optional[str]]:
    """
    'DUPONT, Jean' → ('DUPONT', 'Jean')
    'DUPONT' → ('DUPONT', None)
    """
    if "," in nom_complet:
        parts = nom_complet.split(",", 1)
        return parts[0].strip(), parts[1].strip() or None
    return nom_complet.strip(), None


# Regex pour détecter un code postal français (5 chiffres)
_RE_CP = re.compile(r"\b(\d{5})\b")


def parse_adresse_barotech(raw: str) -> dict:
    """
    Tente de décomposer '129 rue Boecklin 67000 STRASBOURG' en champs structurés.
    Retourne {'rue': ..., 'code_postal': ..., 'ville': ..., 'pays': 'France'}.
    """
    raw = safe_str(raw)
    if not raw:
        return {}
    m = _RE_CP.search(raw)
    if not m:
        return {"rue": raw, "pays": "France"}
    cp = m.group(1)
    cp_start = m.start()
    cp_end = m.end()
    rue = raw[:cp_start].strip().rstrip(",").strip()
    ville = raw[cp_end:].strip()
    return {
        "rue": rue or None,
        "code_postal": cp,
        "ville": ville or None,
        "pays": "France",
    }


def load_csv(path: str, delimiter: str = ";") -> list[dict]:
    with open(path, encoding="utf-8-sig") as f:
        return list(csv.DictReader(f, delimiter=delimiter))


# =============================================================================
# IMPORTEUR
# =============================================================================


class BarotechImporter:
    def __init__(self):
        self.conn = None
        self.cursor = None
        self.stats = {
            "pm_creees": 0,
            "pm_ignorees": 0,
            "pp_creees": 0,
            "pp_ignorees": 0,
            "adresses_creees": 0,
            "rattachements_crees": 0,
            "rattachements_ignores": 0,
            "erreurs": [],
        }
        # raison_sociale → pm_id
        self.pm_map: dict[str, str] = {}
        # ID Contact → pp_id
        self.pp_map: dict[str, str] = {}

    # -------------------------------------------------------------------------
    # CONNEXION
    # -------------------------------------------------------------------------

    def connect(self):
        self.conn = psycopg2.connect(DATABASE_URL)
        self.cursor = self.conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        logger.info("✓ Connexion PostgreSQL établie")

    def disconnect(self):
        if self.cursor:
            self.cursor.close()
        if self.conn:
            self.conn.close()

    # -------------------------------------------------------------------------
    # MAPPING SOURCE
    # -------------------------------------------------------------------------

    def _insert_mapping_source(
        self, entite_crm: str, entite_crm_id: str, source_id_externe: str
    ):
        source_id_externe = source_id_externe[:100]
        self.cursor.execute(
            """
            INSERT INTO mapping_sources
                (entite_crm, entite_crm_id, source_nom, source_id_externe,
                 date_derniere_synchro)
            VALUES (%s, %s, %s, %s, NOW())
            ON CONFLICT (entite_crm, source_nom, source_id_externe)
            DO UPDATE SET
                entite_crm_id = EXCLUDED.entite_crm_id,
                date_derniere_synchro = NOW()
        """,
            (entite_crm, entite_crm_id, SOURCE_NOM, source_id_externe),
        )

    def _already_imported(
        self, entite_crm: str, source_id_externe: str
    ) -> Optional[str]:
        """Retourne l'id CRM si déjà importé, sinon None."""
        source_id_externe = source_id_externe[:100]
        self.cursor.execute(
            """
            SELECT entite_crm_id FROM mapping_sources
            WHERE entite_crm = %s AND source_nom = %s AND source_id_externe = %s
        """,
            (entite_crm, SOURCE_NOM, source_id_externe),
        )
        row = self.cursor.fetchone()
        return row["entite_crm_id"] if row else None

    # -------------------------------------------------------------------------
    # PURGE
    # -------------------------------------------------------------------------

    def purge_barotech_data(self):
        logger.info("=== PHASE 0 : Purge des données BarOtech ===")

        self.cursor.execute(
            """
            SELECT entite_crm, entite_crm_id FROM mapping_sources
            WHERE source_nom = %s
        """,
            (SOURCE_NOM,),
        )
        rows = self.cursor.fetchall()

        pm_ids = [
            r["entite_crm_id"] for r in rows if r["entite_crm"] == "PersonneMorale"
        ]
        pp_ids = [
            r["entite_crm_id"] for r in rows if r["entite_crm"] == "PersonnePhysique"
        ]

        if pp_ids:
            self.cursor.execute(
                "DELETE FROM rattachements_pp_pm WHERE personne_physique_id = ANY(%s::uuid[])",
                (pp_ids,),
            )
            self.cursor.execute(
                "DELETE FROM profil_avocat WHERE personne_physique_id = ANY(%s::uuid[])",
                (pp_ids,),
            )
            self.cursor.execute(
                "DELETE FROM profil_particulier WHERE personne_physique_id = ANY(%s::uuid[])",
                (pp_ids,),
            )
            self.cursor.execute(
                "DELETE FROM personnes_physiques WHERE id = ANY(%s::uuid[])", (pp_ids,)
            )
            logger.info(f"  Supprimé {len(pp_ids)} PP")

        if pm_ids:
            # D'abord mettre les maison_mere_id à NULL pour éviter les FK circulaires
            self.cursor.execute(
                "UPDATE personnes_morales SET maison_mere_id = NULL WHERE id = ANY(%s::uuid[])",
                (pm_ids,),
            )
            self.cursor.execute(
                "DELETE FROM personnes_morales WHERE id = ANY(%s::uuid[])", (pm_ids,)
            )
            logger.info(f"  Supprimé {len(pm_ids)} PM")

        self.cursor.execute(
            "DELETE FROM mapping_sources WHERE source_nom = %s", (SOURCE_NOM,)
        )

        self.conn.commit()
        logger.info("✓ Purge terminée")

    # -------------------------------------------------------------------------
    # ADRESSES
    # -------------------------------------------------------------------------

    def _create_address(
        self, rue=None, complement=None, code_postal=None, ville=None, pays="France"
    ) -> Optional[int]:
        if not any([rue, ville, code_postal]):
            return None
        self.cursor.execute(
            """
            INSERT INTO adresses (rue, complement_adresse, code_postal, ville, pays, type_adresse, modifier_le)
            VALUES (%s, %s, %s, %s, %s, 'SIEGE', NOW())
            RETURNING id
        """,
            (rue or None, complement or None, code_postal or None, ville or None, pays),
        )
        self.stats["adresses_creees"] += 1
        return self.cursor.fetchone()["id"]

    # -------------------------------------------------------------------------
    # PHASE 1 — PM (depuis structures_sirene)
    # -------------------------------------------------------------------------

    def create_pm(self, rows_pm: list[dict], structure_domains: dict[str, set]):
        logger.info("=== PHASE 1 : Création des Personnes Morales ===")

        for row in rows_pm:
            rs = safe_str(row["raison_sociale"])
            if not rs:
                continue

            self.cursor.execute("SAVEPOINT pm_insert")
            try:
                # Idempotence : raison_sociale comme clé externe
                existing = self._already_imported("PersonneMorale", rs)
                if existing:
                    self.pm_map[rs] = existing
                    self.stats["pm_ignorees"] += 1
                    continue

                siret = safe_str(row.get("siret")) or None
                siren = safe_str(row.get("siren")) or None
                siret_siren = siret or siren or None

                # Cabinets individuels = pas de SIRET/SIREN → source BAROTECH
                # Autres = BAROTECH+SIRENE
                is_cabinet_individuel = rs.lower().startswith("cabinet individuel")
                if is_cabinet_individuel or not siret_siren:
                    source_origine = "BAROTECH"
                else:
                    source_origine = "BAROTECH+SIRENE"

                type_structure = safe_str(row.get("type_structure")) or None
                categorie = safe_str(row.get("categorie_entrepri")) or None
                secteur = safe_str(row.get("secteur_activite")) or None
                site_web = safe_str(row.get("site_web")) or None
                pays = safe_str(row.get("pays")) or "France"

                # Adresse
                addr_id = self._create_address(
                    rue=safe_str(row.get("rue")) or None,
                    complement=safe_str(row.get("complement_adres")) or None,
                    code_postal=safe_str(row.get("code_postal")) or None,
                    ville=safe_str(row.get("ville")) or None,
                    pays=pays,
                )

                # nomDomaine depuis les emails des PP membres
                domains = structure_domains.get(rs, set())
                nom_domaine = " ".join(sorted(domains)) or None

                self.cursor.execute(
                    """
                    INSERT INTO personnes_morales
                        (raison_sociale, siret_siren, type_structure,
                         categorie_entreprise, secteur_activite, site_web,
                         nom_domaine, source_origine,
                         adresse_id, actif, creer_par, modifier_par, modifier_le)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, true,
                            'import_barotech', 'import_barotech', NOW())
                    RETURNING id
                """,
                    (
                        rs,
                        siret_siren,
                        type_structure,
                        categorie,
                        secteur,
                        site_web,
                        nom_domaine,
                        source_origine,
                        addr_id,
                    ),
                )
                pm_id = self.cursor.fetchone()["id"]
                self.pm_map[rs] = pm_id
                self._insert_mapping_source("PersonneMorale", pm_id, rs)
                self.stats["pm_creees"] += 1

                self.cursor.execute("RELEASE SAVEPOINT pm_insert")

            except Exception as e:
                self.cursor.execute("ROLLBACK TO SAVEPOINT pm_insert")
                msg = f"Erreur PM {rs!r}: {e}"
                logger.error(f"✗ {msg}")
                self.stats["erreurs"].append(msg)

        self.conn.commit()
        logger.info(
            f"✓ PM : {self.stats['pm_creees']} créées, "
            f"{self.stats['pm_ignorees']} déjà présentes"
        )

    # -------------------------------------------------------------------------
    # PHASE 2 — PP (depuis barotech_specialities_activites)
    # -------------------------------------------------------------------------

    def create_pp(self, rows_pp: list[dict]):
        logger.info("=== PHASE 2 : Création des Personnes Physiques ===")

        for row in rows_pp:
            contact_id = safe_str(row.get("ID Contact"))
            if not contact_id:
                continue

            self.cursor.execute("SAVEPOINT pp_insert")
            try:
                existing = self._already_imported("PersonnePhysique", contact_id)
                if existing:
                    self.pp_map[contact_id] = existing
                    self.stats["pp_ignorees"] += 1
                    continue

                nom_complet = safe_str(row.get("Nom Complet"))
                if not nom_complet:
                    continue
                nom, prenom = parse_nom_prenom(nom_complet)

                barreau = safe_str(row.get("Barreau")) or None
                date_serment = parse_date(safe_str(row.get("Date serment")))

                # Spécialité : première valeur
                specialites = split_pipe(safe_str(row.get("Spécialité(s)", "")))
                specialite = specialites[0] if specialites else None

                # Si pas de spécialité, prendre la première activité dominante
                if not specialite:
                    activites = split_pipe(
                        safe_str(row.get("Activité(s) dominante(s)", ""))
                    )
                    specialite = activites[0] if activites else None

                # Emails : tous les emails valides, joints par " | "
                emails_raw = split_pipe(safe_str(row.get("Email(s)", "")))
                emails_valides = [
                    normalize_email(e) for e in emails_raw if normalize_email(e)
                ]
                email = " | ".join(emails_valides) if emails_valides else None

                # Téléphones : premier = telephone, deuxième = portable
                tels = split_pipe(safe_str(row.get("Téléphone(s)", "")))
                telephone = tels[0] if len(tels) >= 1 else None
                portable = tels[1] if len(tels) >= 2 else None

                # Adresse : première adresse
                addrs_raw = split_pipe(safe_str(row.get("Adresse(s)", "")))
                addr_id = None
                if addrs_raw:
                    parsed = parse_adresse_barotech(addrs_raw[0])
                    if parsed:
                        addr_id = self._create_address(
                            rue=parsed.get("rue"),
                            code_postal=parsed.get("code_postal"),
                            ville=parsed.get("ville"),
                            pays=parsed.get("pays", "France"),
                        )

                self.cursor.execute(
                    """
                    INSERT INTO personnes_physiques
                        (nom, prenom, email, telephone, portable,
                         adresse_id, actif, type_profil_principal, type_relation_dossier,
                         creer_par, modifier_par, modifier_le)
                    VALUES (%s, %s, %s, %s, %s, %s,
                            true, 'AVOCAT_EXTERNE', %s,
                            'import_barotech', 'import_barotech', NOW())
                    RETURNING id
                """,
                    (
                        nom,
                        prenom,
                        email or None,
                        telephone,
                        portable,
                        addr_id,
                        "CONTACT",
                    ),
                )
                pp_id = self.cursor.fetchone()["id"]

                # Champs avocat dans la table dédiée
                self.cursor.execute(
                    """
                    INSERT INTO profil_avocat
                        (personne_physique_id, profession, barreau, date_serment,
                         specialite, modifier_le)
                    VALUES (%s, %s, %s, %s, %s, NOW())
                """,
                    (pp_id, "Avocat", barreau, date_serment, specialite),
                )

                self.pp_map[contact_id] = pp_id
                self._insert_mapping_source("PersonnePhysique", pp_id, contact_id)
                self.stats["pp_creees"] += 1

                self.cursor.execute("RELEASE SAVEPOINT pp_insert")

            except Exception as e:
                self.cursor.execute("ROLLBACK TO SAVEPOINT pp_insert")
                msg = f"Erreur PP {safe_str(row.get('Nom Complet'))!r} ({contact_id}): {e}"
                logger.error(f"✗ {msg}")
                self.stats["erreurs"].append(msg)

        self.conn.commit()
        logger.info(
            f"✓ PP : {self.stats['pp_creees']} créées, "
            f"{self.stats['pp_ignorees']} déjà présentes"
        )

    # -------------------------------------------------------------------------
    # PHASE 3 — RATTACHEMENTS PP ↔ PM
    # -------------------------------------------------------------------------

    def create_rattachements(self, rows_pp: list[dict]):
        logger.info("=== PHASE 3 : Création des rattachements PP ↔ PM ===")

        today = date.today()
        unknown_structures: set[str] = set()

        for row in rows_pp:
            contact_id = safe_str(row.get("ID Contact"))
            pp_id = self.pp_map.get(contact_id)
            if not pp_id:
                continue

            date_serment = parse_date(safe_str(row.get("Date serment")))
            date_debut = date_serment or today

            structures = split_pipe(safe_str(row.get("Structure(s)", "")))
            for rs in structures:
                pm_id = self.pm_map.get(rs)
                if not pm_id:
                    unknown_structures.add(rs)
                    continue

                self.cursor.execute("SAVEPOINT ratt_insert")
                try:
                    # Idempotence : éviter les doublons (même PP + PM + date_debut)
                    self.cursor.execute(
                        """
                        SELECT id FROM rattachements_pp_pm
                        WHERE personne_physique_id = %s
                          AND personne_morale_id = %s
                          AND date_debut = %s
                    """,
                        (pp_id, pm_id, date_debut),
                    )
                    if self.cursor.fetchone():
                        self.stats["rattachements_ignores"] += 1
                        self.cursor.execute("RELEASE SAVEPOINT ratt_insert")
                        continue

                    self.cursor.execute(
                        """
                        INSERT INTO rattachements_pp_pm
                            (personne_physique_id, personne_morale_id,
                             titre_fonction, date_debut, date_fin,
                             modifier_le)
                        VALUES (%s, %s, %s, %s, NULL, NOW())
                    """,
                        (pp_id, pm_id, "Avocat", date_debut),
                    )
                    self.stats["rattachements_crees"] += 1

                    self.cursor.execute("RELEASE SAVEPOINT ratt_insert")

                except Exception as e:
                    self.cursor.execute("ROLLBACK TO SAVEPOINT ratt_insert")
                    msg = f"Erreur rattachement PP {pp_id} → PM {pm_id}: {e}"
                    logger.error(f"✗ {msg}")
                    self.stats["erreurs"].append(msg)

        self.conn.commit()

        if unknown_structures:
            logger.warning(
                f"  {len(unknown_structures)} structures dans les contacts sans PM correspondante "
                f"(ex. : {list(unknown_structures)[:5]})"
            )
        logger.info(
            f"✓ Rattachements : {self.stats['rattachements_crees']} créés, "
            f"{self.stats['rattachements_ignores']} déjà présents"
        )

    # -------------------------------------------------------------------------
    # RAPPORT
    # -------------------------------------------------------------------------

    def log_report(self):
        logger.info("=" * 60)
        logger.info("RAPPORT FINAL")
        logger.info("=" * 60)
        logger.info(f"  PM créées          : {self.stats['pm_creees']}")
        logger.info(f"  PM ignorées        : {self.stats['pm_ignorees']}")
        logger.info(f"  PP créées          : {self.stats['pp_creees']}")
        logger.info(f"  PP ignorées        : {self.stats['pp_ignorees']}")
        logger.info(f"  Adresses créées    : {self.stats['adresses_creees']}")
        logger.info(f"  Rattachements créés: {self.stats['rattachements_crees']}")
        if self.stats["erreurs"]:
            logger.warning(f"  Erreurs            : {len(self.stats['erreurs'])}")
            for err in self.stats["erreurs"][:20]:
                logger.warning(f"    - {err}")
        logger.info("=" * 60)

    # -------------------------------------------------------------------------
    # POINT D'ENTRÉE
    # -------------------------------------------------------------------------

    def run(self):
        logger.info("=== IMPORT BAROTECH → CRM LX ===")

        rows_pp = load_csv(CSV_PP)
        rows_pm = load_csv(CSV_PM)
        logger.info(f"  {len(rows_pp)} PP chargées depuis {os.path.basename(CSV_PP)}")
        logger.info(f"  {len(rows_pm)} PM chargées depuis {os.path.basename(CSV_PM)}")

        # Pré-calcul des domaines par PM depuis les emails des PP.
        # On ne déduit le domaine que si la PP a exactement un email pro
        # (plusieurs emails pro = ambiguïté sur quel domaine appartient à quelle structure).
        structure_domains: dict[str, set] = defaultdict(set)
        for row in rows_pp:
            emails = split_pipe(safe_str(row.get("Email(s)", "")))
            structures = split_pipe(safe_str(row.get("Structure(s)", "")))
            unique_domains = {d for d in (domain_from_email(e) for e in emails) if d}
            if len(unique_domains) == 1:
                # On exclut les cabinets individuels : le domaine pro d'une PP
                # appartient à la structure tierce, pas à son cabinet personnel.
                target_structures = [
                    rs
                    for rs in structures
                    if not rs.lower().startswith("cabinet individuel")
                ]
                for rs in target_structures:
                    structure_domains[rs].add(next(iter(unique_domains)))

        logger.info(f"  {len(structure_domains)} PM avec au moins un domaine déduit")

        self.connect()
        try:
            self.purge_barotech_data()
            self.create_pm(rows_pm, structure_domains)
            self.create_pp(rows_pp)
            self.create_rattachements(rows_pp)
        finally:
            self.disconnect()

        self.log_report()


if __name__ == "__main__":
    BarotechImporter().run()
