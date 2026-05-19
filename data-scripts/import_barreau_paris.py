"""
=============================================================================
IMPORT BARREAU DE PARIS → CRM LX
=============================================================================
Sources :
  - data/barreau-Paris/extraction_barreau_paris_pp.csv           (PP)
  - data/barreau-Paris/extraction_structures_barreau_paris.csv   (PM)

Exécution :
    uv run python import_barreau_paris.py          # base de TEST (défaut)
    uv run python import_barreau_paris.py --dev    # base de DEV
    uv run python import_barreau_paris.py --purge  # purge puis re-import

Logique :
  1. PM   — créées depuis extraction_structures_barreau_paris.
             source_nom = 'avocatparis+SIRENE' (SIRET trouvé) ou 'avocatparis'.
             Si une PM de même nom normalisé existe déjà en base (ex. FIDAL),
             elle est réutilisée sans duplication.
             type_structure = 'cabinet d'avocats' pour toutes les PM créées.

  2. PP   — créées depuis extraction_barreau_paris_pp.
             mapping_sources.source_nom = 'avocatparis'.
             source_id_externe = ID Contact.
             barreau = 'PARIS' (valeur fixe).
             Nom complet au format 'Prénom NOM'.

  3. Rattachements PP ↔ PM via le champ Structure(s) du CSV PP.
             date_debut = aujourd'hui (pas de date_serment dans la source).

  4. Linking par domaine email — PP sans structure après phase 3 :
             domaine de l'email → PM avec nom_domaine correspondant.
=============================================================================
"""

import argparse
import csv
import logging
import os
import re
import sys
import unicodedata
from collections import defaultdict
from datetime import date
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
        logging.FileHandler(os.path.join(OUTPUT_DIR, "import_barreau_paris.log")),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger(__name__)

# =============================================================================
# CONFIGURATION
# =============================================================================


def _resolve_args():
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--dev", action="store_true")
    parser.add_argument("--purge", action="store_true")
    return parser.parse_known_args()[0]


_ARGS = _resolve_args()


def _resolve_database_url() -> str:
    if _ARGS.dev:
        url = os.environ["DATABASE_URL"]
        logger.info("⚠️  Mode DEV — base de développement")
    else:
        url = os.environ["TEST_DATABASE_URL"]
        logger.info("ℹ️  Mode TEST (défaut) — base de test")
    return url


DATABASE_URL = _resolve_database_url()

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(_SCRIPT_DIR, "data", "barreau-Paris")
CSV_PP = os.path.join(DATA_DIR, "extraction_barreau_paris_pp.csv")
CSV_PM = os.path.join(DATA_DIR, "extraction_structures_barreau_paris.csv")

SOURCE_NOM_PP = "avocatparis"
SOURCE_NOM_PM = "avocatparis"
SOURCE_NOM_PM_SIRENE = "avocatparis+SIRENE"

BARREAU = "PARIS"
TYPE_STRUCTURE = "cabinet d'avocats"

_DOMAINES_GENERIQUES = {
    "gmail.com", "googlemail.com",
    "yahoo.com", "yahoo.fr", "ymail.com",
    "hotmail.com", "hotmail.fr", "outlook.com", "outlook.fr",
    "live.com", "live.fr", "msn.com",
    "orange.fr", "wanadoo.fr", "wanadoo.com",
    "free.fr", "sfr.fr", "neuf.fr", "numericable.fr",
    "laposte.net", "bbox.fr",
    "icloud.com", "me.com", "mac.com",
    "aol.com", "aol.fr",
    "protonmail.com", "proton.me",
    "tutanota.com", "gmx.com", "gmx.fr",
    "avocat.fr", "avocats.fr",
}

# =============================================================================
# UTILITAIRES
# =============================================================================


def safe_str(val) -> str:
    if val is None:
        return ""
    return str(val).strip()


def split_pipe(val: str) -> list[str]:
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


def _is_all_caps_token(token: str) -> bool:
    """True si tous les caractères alphabétiques du token sont en majuscules."""
    alpha = "".join(c for c in token if c.isalpha())
    return len(alpha) > 0 and alpha.isupper()


def parse_nom_prenom_paris(nom_complet: str) -> tuple[str, Optional[str]]:
    """
    Découpe 'Prénom NOM' (format barreau Paris).
    'Morgane VALENTIN'          → ('VALENTIN', 'Morgane')
    'Jean-François CHARROIN'    → ('CHARROIN', 'Jean-François')
    'Johanna DA COSTA OLIVEIRA' → ('DA COSTA OLIVEIRA', 'Johanna')
    """
    parts = nom_complet.strip().split()
    if not parts:
        return nom_complet.strip(), None

    nom_start = next(
        (i for i, p in enumerate(parts) if _is_all_caps_token(p)),
        None,
    )
    if nom_start is None:
        return nom_complet.strip(), None

    nom = " ".join(parts[nom_start:])
    prenom = " ".join(parts[:nom_start]) or None
    return nom, prenom


_RE_FORM_SUFFIX = re.compile(r"\s*\([^)]+\)\s*$")


def extract_base_name(raison_sociale: str) -> str:
    """
    Retire le suffixe de forme juridique entre parenthèses.
    'FIDAL (SARL)' → 'FIDAL'
    'AUGUST & DEBOUZY ET ASSOCIÉS (SCP)' → 'AUGUST & DEBOUZY ET ASSOCIÉS'
    """
    return _RE_FORM_SUFFIX.sub("", raison_sociale).strip()


def normalize_name(name: str) -> str:
    """Minuscules, sans accents, espaces normalisés — pour comparaison floue."""
    s = name.lower()
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"[^a-z0-9]", " ", s)
    return " ".join(s.split())


_RE_CP = re.compile(r"\b(\d{5})\b")


def parse_adresse_str(raw: str) -> dict:
    """
    '44 RUE DE PRONY   75017 PARIS' → {rue, code_postal, ville, pays}.
    """
    raw = safe_str(raw)
    if not raw:
        return {}
    m = _RE_CP.search(raw)
    if not m:
        return {"rue": raw, "pays": "France"}
    cp = m.group(1)
    rue = raw[: m.start()].strip().rstrip(",").strip()
    ville = raw[m.end() :].strip()
    return {
        "rue": rue or None,
        "code_postal": cp,
        "ville": ville or None,
        "pays": "France",
    }


def load_csv(path: str) -> list[dict]:
    with open(path, encoding="utf-8-sig") as f:
        return list(csv.DictReader(f, delimiter=";"))


# =============================================================================
# IMPORTEUR
# =============================================================================


class BarreauParisImporter:
    def __init__(self):
        self.conn = None
        self.cursor = None
        self.stats = {
            "pm_creees": 0,
            "pm_existantes": 0,
            "pm_ignorees": 0,
            "pp_creees": 0,
            "pp_ignorees": 0,
            "adresses_creees": 0,
            "rattachements_crees": 0,
            "rattachements_ignores": 0,
            "linking_domaine": 0,
            "erreurs": [],
        }
        self.pm_map: dict[str, int] = {}  # raison_sociale_full → pm_id
        self.pp_map: dict[str, int] = {}  # ID Contact → pp_id

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
        self,
        entite_crm: str,
        entite_crm_id: int,
        source_nom: str,
        source_id_externe: str,
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
            (entite_crm, entite_crm_id, source_nom, source_id_externe),
        )

    def _already_imported(
        self, entite_crm: str, source_nom: str, source_id_externe: str
    ) -> Optional[int]:
        source_id_externe = source_id_externe[:100]
        self.cursor.execute(
            """
            SELECT entite_crm_id FROM mapping_sources
            WHERE entite_crm = %s AND source_nom = %s AND source_id_externe = %s
            """,
            (entite_crm, source_nom, source_id_externe),
        )
        row = self.cursor.fetchone()
        return row["entite_crm_id"] if row else None

    def _already_imported_pm(self, source_id_externe: str) -> Optional[int]:
        """Vérifie mapping_sources pour une PM, quelle que soit la source Paris."""
        source_id_externe = source_id_externe[:100]
        self.cursor.execute(
            """
            SELECT entite_crm_id FROM mapping_sources
            WHERE entite_crm = 'PersonneMorale'
              AND source_nom IN (%s, %s)
              AND source_id_externe = %s
            """,
            (SOURCE_NOM_PM, SOURCE_NOM_PM_SIRENE, source_id_externe),
        )
        row = self.cursor.fetchone()
        return row["entite_crm_id"] if row else None

    # -------------------------------------------------------------------------
    # PURGE
    # -------------------------------------------------------------------------

    def purge_data(self):
        logger.info("=== PHASE 0 : Purge des données Barreau de Paris ===")

        self.cursor.execute(
            """
            SELECT entite_crm, entite_crm_id FROM mapping_sources
            WHERE source_nom IN (%s, %s, %s)
            """,
            (SOURCE_NOM_PP, SOURCE_NOM_PM, SOURCE_NOM_PM_SIRENE),
        )
        rows = self.cursor.fetchall()

        pm_ids = list({r["entite_crm_id"] for r in rows if r["entite_crm"] == "PersonneMorale"})
        pp_ids = list({r["entite_crm_id"] for r in rows if r["entite_crm"] == "PersonnePhysique"})

        if pp_ids:
            self.cursor.execute(
                "DELETE FROM rattachements_pp_pm WHERE personne_physique_id = ANY(%s)",
                (pp_ids,),
            )
            self.cursor.execute(
                "DELETE FROM personnes_physiques WHERE id = ANY(%s)",
                (pp_ids,),
            )
            logger.info(f"  Supprimé {len(pp_ids)} PP")

        if pm_ids:
            self.cursor.execute(
                "UPDATE personnes_morales SET maison_mere_id = NULL WHERE id = ANY(%s)",
                (pm_ids,),
            )
            self.cursor.execute(
                "DELETE FROM personnes_morales WHERE id = ANY(%s)",
                (pm_ids,),
            )
            logger.info(f"  Supprimé {len(pm_ids)} PM")

        self.cursor.execute(
            "DELETE FROM mapping_sources WHERE source_nom IN (%s, %s, %s)",
            (SOURCE_NOM_PP, SOURCE_NOM_PM, SOURCE_NOM_PM_SIRENE),
        )

        self.conn.commit()
        logger.info("✓ Purge terminée")

    # -------------------------------------------------------------------------
    # ADRESSES
    # -------------------------------------------------------------------------

    def _create_address(
        self,
        rue=None,
        complement=None,
        code_postal=None,
        ville=None,
        pays="France",
    ) -> Optional[int]:
        if not any([rue, ville, code_postal]):
            return None
        self.cursor.execute(
            """
            INSERT INTO adresses
                (rue, complement_adresse, code_postal, ville, pays,
                 type_adresse, modifier_le)
            VALUES (%s, %s, %s, %s, %s, 'SIEGE', NOW())
            RETURNING id
            """,
            (rue or None, complement or None, code_postal or None, ville or None, pays),
        )
        self.stats["adresses_creees"] += 1
        return self.cursor.fetchone()["id"]

    # -------------------------------------------------------------------------
    # INDEX DES PM EXISTANTES
    # -------------------------------------------------------------------------

    def _load_existing_pm_index(self) -> dict[str, int]:
        """
        Charge toutes les PM présentes en base dans un index de recherche rapide.
        Clé : nom normalisé sans suffixe de forme juridique.
        Permet de détecter des PM pré-existantes (ex. 'FIDAL' pour 'FIDAL (SARL)').
        """
        self.cursor.execute("SELECT id, raison_sociale FROM personnes_morales")
        index: dict[str, int] = {}
        for row in self.cursor.fetchall():
            base = extract_base_name(safe_str(row["raison_sociale"]))
            key = normalize_name(base)
            if key:
                index[key] = row["id"]
        return index

    # -------------------------------------------------------------------------
    # PHASE 1 — PM
    # -------------------------------------------------------------------------

    def create_pm(self, rows_pm: list[dict], structure_domains: dict[str, set]):
        logger.info("=== PHASE 1 : Création des Personnes Morales ===")

        existing_pm_index = self._load_existing_pm_index()
        logger.info(f"  {len(existing_pm_index)} PM existantes en base indexées")

        for row in rows_pm:
            rs = safe_str(row["raison_sociale"])
            if not rs:
                continue

            self.cursor.execute("SAVEPOINT pm_insert")
            try:
                # Déjà importé via mapping_sources ?
                existing_id = self._already_imported_pm(rs)
                if existing_id:
                    self.pm_map[rs] = existing_id
                    self.stats["pm_ignorees"] += 1
                    self.cursor.execute("RELEASE SAVEPOINT pm_insert")
                    continue

                # PM pré-existante en base (même nom sans forme juridique) ?
                base_key = normalize_name(extract_base_name(rs))
                if base_key in existing_pm_index:
                    pm_id = existing_pm_index[base_key]
                    self.pm_map[rs] = pm_id
                    self.stats["pm_existantes"] += 1
                    logger.info(f"  Réutilisation PM existante : {rs!r} → id={pm_id}")
                    self.cursor.execute("RELEASE SAVEPOINT pm_insert")
                    continue

                # Créer nouvelle PM
                siret = safe_str(row.get("siret")) or None
                siren = safe_str(row.get("siren")) or None
                siret_siren = siret or siren or None
                sirene_ok = safe_str(row.get("sirene_trouve")) == "oui" and bool(siret_siren)

                source_nom_pm = SOURCE_NOM_PM_SIRENE if sirene_ok else SOURCE_NOM_PM
                source_origine = "BARREAU_PARIS+SIRENE" if sirene_ok else "BARREAU_PARIS"

                site_web = safe_str(row.get("site_web")) or None
                categorie = safe_str(row.get("categorie_entrepri")) or None
                secteur = safe_str(row.get("secteur_activite")) or None
                pays = safe_str(row.get("pays")) or "France"

                addr_id = self._create_address(
                    rue=safe_str(row.get("rue")) or None,
                    complement=safe_str(row.get("complement_adres")) or None,
                    code_postal=safe_str(row.get("code_postal")) or None,
                    ville=safe_str(row.get("ville")) or None,
                    pays=pays,
                )

                # nomDomaine alimenté depuis les emails des PP membres
                domains = structure_domains.get(rs, set())
                nom_domaine = " ".join(sorted(domains)) or None

                self.cursor.execute(
                    """
                    INSERT INTO personnes_morales
                        (raison_sociale, siret_siren, type_structure,
                         categorie_entreprise, secteur_activite, site_web,
                         nom_domaine, source_origine,
                         adresse_id, actif, creer_par, modifier_par, modifier_le)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s,
                            true, 'import_barreau_paris', 'import_barreau_paris', NOW())
                    RETURNING id
                    """,
                    (
                        rs, siret_siren, TYPE_STRUCTURE,
                        categorie, secteur, site_web,
                        nom_domaine, source_origine,
                        addr_id,
                    ),
                )
                pm_id = self.cursor.fetchone()["id"]
                self.pm_map[rs] = pm_id
                existing_pm_index[base_key] = pm_id  # mise à jour index pour idempotence intra-run
                self._insert_mapping_source("PersonneMorale", pm_id, source_nom_pm, rs)
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
            f"{self.stats['pm_existantes']} réutilisées (pré-existantes), "
            f"{self.stats['pm_ignorees']} déjà importées"
        )

    # -------------------------------------------------------------------------
    # PHASE 2 — PP
    # -------------------------------------------------------------------------

    def create_pp(self, rows_pp: list[dict]):
        logger.info("=== PHASE 2 : Création des Personnes Physiques ===")

        for row in rows_pp:
            contact_id = safe_str(row.get("ID Contact"))
            if not contact_id:
                continue

            self.cursor.execute("SAVEPOINT pp_insert")
            try:
                existing = self._already_imported("PersonnePhysique", SOURCE_NOM_PP, contact_id)
                if existing:
                    self.pp_map[contact_id] = existing
                    self.stats["pp_ignorees"] += 1
                    self.cursor.execute("RELEASE SAVEPOINT pp_insert")
                    continue

                nom_complet = safe_str(row.get("Nom Complet"))
                if not nom_complet:
                    continue
                nom, prenom = parse_nom_prenom_paris(nom_complet)

                # Emails
                emails_raw = split_pipe(safe_str(row.get("Email(s)", "")))
                emails_valides = [normalize_email(e) for e in emails_raw if normalize_email(e)]
                email = " | ".join(emails_valides) if emails_valides else None

                # Téléphones : premier = fixe, second = portable
                tels = split_pipe(safe_str(row.get("Téléphone(s)", "")))
                telephone = tels[0] if len(tels) >= 1 else None
                portable = tels[1] if len(tels) >= 2 else None

                # Adresse : première entrée (format string brut)
                addrs_raw = split_pipe(safe_str(row.get("Adresse(s)", "")))
                addr_id = None
                if addrs_raw:
                    parsed = parse_adresse_str(addrs_raw[0])
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
                         profession, barreau,
                         adresse_id, actif, type_relation_dossier,
                         creer_par, modifier_par, modifier_le)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s,
                            true, %s,
                            'import_barreau_paris', 'import_barreau_paris', NOW())
                    RETURNING id
                    """,
                    (
                        nom, prenom, email, telephone, portable,
                        "Avocat", BARREAU,
                        addr_id, "CONTACT",
                    ),
                )
                pp_id = self.cursor.fetchone()["id"]
                self.pp_map[contact_id] = pp_id
                self._insert_mapping_source("PersonnePhysique", pp_id, SOURCE_NOM_PP, contact_id)
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

            structures = split_pipe(safe_str(row.get("Structure(s)", "")))
            for rs in structures:
                pm_id = self.pm_map.get(rs)
                if not pm_id:
                    unknown_structures.add(rs)
                    continue

                self.cursor.execute("SAVEPOINT ratt_insert")
                try:
                    self.cursor.execute(
                        """
                        SELECT id FROM rattachements_pp_pm
                        WHERE personne_physique_id = %s
                          AND personne_morale_id = %s
                          AND date_debut = %s
                        """,
                        (pp_id, pm_id, today),
                    )
                    if self.cursor.fetchone():
                        self.stats["rattachements_ignores"] += 1
                        self.cursor.execute("RELEASE SAVEPOINT ratt_insert")
                        continue

                    self.cursor.execute(
                        """
                        INSERT INTO rattachements_pp_pm
                            (personne_physique_id, personne_morale_id,
                             titre_fonction, date_debut, date_fin, modifier_le)
                        VALUES (%s, %s, %s, %s, NULL, NOW())
                        """,
                        (pp_id, pm_id, "Avocat", today),
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
    # PHASE 4 — LINKING PAR DOMAINE EMAIL
    # -------------------------------------------------------------------------

    def link_by_domain(self):
        logger.info("=== PHASE 4 : Linking PP sans structure → PM par domaine email ===")

        if not self.pp_map:
            return

        # PP importées sans aucun rattachement
        all_pp_ids = list(self.pp_map.values())
        self.cursor.execute(
            """
            SELECT DISTINCT personne_physique_id FROM rattachements_pp_pm
            WHERE personne_physique_id = ANY(%s)
            """,
            (all_pp_ids,),
        )
        pp_ids_with_ratt = {r["personne_physique_id"] for r in self.cursor.fetchall()}
        pp_sans_structure = [pid for pid in all_pp_ids if pid not in pp_ids_with_ratt]

        if not pp_sans_structure:
            logger.info("  Aucune PP sans structure à vérifier")
            return

        logger.info(f"  {len(pp_sans_structure)} PP sans structure → recherche par domaine email")

        # Index domaine → pm_id depuis les PM existantes
        self.cursor.execute(
            """
            SELECT id, nom_domaine FROM personnes_morales
            WHERE nom_domaine IS NOT NULL AND nom_domaine != ''
            """
        )
        domain_to_pm: dict[str, int] = {}
        for row in self.cursor.fetchall():
            for d in row["nom_domaine"].split():
                d = d.strip().lower()
                if d:
                    domain_to_pm[d] = row["id"]

        # Emails des PP sans structure
        self.cursor.execute(
            """
            SELECT id, email FROM personnes_physiques
            WHERE id = ANY(%s) AND email IS NOT NULL
            """,
            (pp_sans_structure,),
        )
        pp_emails = {r["id"]: r["email"] for r in self.cursor.fetchall()}

        today = date.today()
        for pp_id, email_str in pp_emails.items():
            for email in split_pipe(email_str):
                d = domain_from_email(email)
                if not d:
                    continue
                pm_id = domain_to_pm.get(d)
                if not pm_id:
                    continue

                self.cursor.execute("SAVEPOINT link_domain")
                try:
                    self.cursor.execute(
                        """
                        SELECT id FROM rattachements_pp_pm
                        WHERE personne_physique_id = %s AND personne_morale_id = %s
                        """,
                        (pp_id, pm_id),
                    )
                    if self.cursor.fetchone():
                        self.cursor.execute("RELEASE SAVEPOINT link_domain")
                        continue

                    self.cursor.execute(
                        """
                        INSERT INTO rattachements_pp_pm
                            (personne_physique_id, personne_morale_id,
                             titre_fonction, date_debut, date_fin, modifier_le)
                        VALUES (%s, %s, %s, %s, NULL, NOW())
                        """,
                        (pp_id, pm_id, "Avocat", today),
                    )
                    self.stats["linking_domaine"] += 1
                    self.cursor.execute("RELEASE SAVEPOINT link_domain")
                    break  # un seul rattachement par domaine suffit

                except Exception as e:
                    self.cursor.execute("ROLLBACK TO SAVEPOINT link_domain")
                    logger.warning(f"  Erreur linking domaine PP {pp_id} → PM {pm_id}: {e}")

        self.conn.commit()
        logger.info(f"✓ Linking domaine : {self.stats['linking_domaine']} rattachements créés")

    # -------------------------------------------------------------------------
    # RAPPORT
    # -------------------------------------------------------------------------

    def log_report(self):
        logger.info("=" * 60)
        logger.info("RAPPORT FINAL")
        logger.info("=" * 60)
        logger.info(f"  PM créées          : {self.stats['pm_creees']}")
        logger.info(f"  PM réutilisées     : {self.stats['pm_existantes']} (pré-existantes, non dupliquées)")
        logger.info(f"  PM ignorées        : {self.stats['pm_ignorees']} (déjà importées)")
        logger.info(f"  PP créées          : {self.stats['pp_creees']}")
        logger.info(f"  PP ignorées        : {self.stats['pp_ignorees']}")
        logger.info(f"  Adresses créées    : {self.stats['adresses_creees']}")
        logger.info(f"  Rattachements créés: {self.stats['rattachements_crees']}")
        logger.info(f"  Linking domaine    : {self.stats['linking_domaine']}")
        if self.stats["erreurs"]:
            logger.warning(f"  Erreurs            : {len(self.stats['erreurs'])}")
            for err in self.stats["erreurs"][:20]:
                logger.warning(f"    - {err}")
        logger.info("=" * 60)

    # -------------------------------------------------------------------------
    # POINT D'ENTRÉE
    # -------------------------------------------------------------------------

    def run(self):
        logger.info("=== IMPORT BARREAU DE PARIS → CRM LX ===")

        rows_pp = load_csv(CSV_PP)
        rows_pm = load_csv(CSV_PM)
        logger.info(f"  {len(rows_pp)} PP chargées depuis {os.path.basename(CSV_PP)}")
        logger.info(f"  {len(rows_pm)} PM chargées depuis {os.path.basename(CSV_PM)}")

        # Pré-calcul des domaines email par PM depuis les emails des PP membres.
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
                target_structures = [rs for rs in structures if not rs.lower().startswith("cabinet individuel")]
                for rs in target_structures:
                    structure_domains[rs].add(next(iter(unique_domains)))

        logger.info(f"  {len(structure_domains)} PM avec au moins un domaine déduit")

        self.connect()
        try:
            if _ARGS.purge:
                self.purge_data()
            self.create_pm(rows_pm, structure_domains)
            self.create_pp(rows_pp)
            self.create_rattachements(rows_pp)
            self.link_by_domain()
        finally:
            self.disconnect()

        self.log_report()


if __name__ == "__main__":
    BarreauParisImporter().run()
