"""
=============================================================================
IMPORT BARREAU D'AMIENS → CRM LX
=============================================================================
Source :
  - data/amiens/extraction_barreau_amiens.csv  (PP uniquement)

Exécution :
    uv run python import_barreau_amiens.py          # base de TEST (défaut)
    uv run python import_barreau_amiens.py --dev    # base de DEV
    uv run python import_barreau_amiens.py --purge  # purge puis re-import

Logique :
  1. PP   — créées depuis extraction_barreau_amiens.csv.
             source_nom = 'BarreauAmiens'.
             source_id_externe = Nom Complet (pas d'ID dans la source).
             type_profil_principal = 'AVOCAT_EXTERNE'.
             barreau = 'AMIENS', profession = 'Avocat' → profil_avocat.
             Déduplication : mapping_sources + vérification nom/prénom en base.

  2. Linking par domaine email — PP dont l'email a un domaine professionnel :
             domaine → PM avec nom_domaine correspondant déjà en base.
             (Pas de PM dans la source : annuaire sans données de structure)
=============================================================================
"""

import argparse
import csv
import logging
import os
import re
import sys
import unicodedata
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
        logging.FileHandler(os.path.join(OUTPUT_DIR, "import_barreau_amiens.log")),
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
CSV_PP = os.path.join(_SCRIPT_DIR, "data", "amiens", "extraction_barreau_amiens.csv")

SOURCE_NOM = "BarreauAmiens"
BARREAU = "AMIENS"
TYPE_PROFIL = "AVOCAT_EXTERNE"

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
    "avocat.fr",
    "avocats.fr",
}

_MOIS_FR = {
    "janvier": 1,
    "février": 2,
    "fevrier": 2,
    "mars": 3,
    "avril": 4,
    "mai": 5,
    "juin": 6,
    "juillet": 7,
    "août": 8,
    "aout": 8,
    "septembre": 9,
    "octobre": 10,
    "novembre": 11,
    "décembre": 12,
    "decembre": 12,
}

# =============================================================================
# UTILITAIRES
# =============================================================================


def safe_str(val) -> str:
    return "" if val is None else str(val).strip()


def normalize_email(val: str) -> str:
    s = safe_str(val).lower()
    return s if "@" in s else ""


def domain_from_email(val: str) -> Optional[str]:
    s = normalize_email(val)
    if not s:
        return None
    domain = s.split("@")[1].lower()
    return None if domain in _DOMAINES_GENERIQUES else domain


def split_semi(val: str) -> list[str]:
    """Sépare les valeurs multiples séparées par ';' ou '|'."""
    parts = re.split(r"[;|]", val)
    return [p.strip() for p in parts if p.strip()]


def parse_date_serment(val: str) -> Optional[date]:
    """Convertit 'Novembre 2016' → date(2016, 11, 1)."""
    s = safe_str(val).strip().lower()
    if not s:
        return None
    parts = s.split()
    if len(parts) == 2:
        mois = _MOIS_FR.get(parts[0])
        try:
            annee = int(parts[1])
        except ValueError:
            return None
        if mois and 1900 <= annee <= 2100:
            return date(annee, mois, 1)
    return None


def _is_all_caps_token(token: str) -> bool:
    alpha = "".join(c for c in token if c.isalpha())
    return len(alpha) > 0 and alpha.isupper()


def parse_nom_prenom(nom_complet: str) -> tuple[str, Optional[str]]:
    """
    Format 'Prénom NOM' (même convention que barreau Paris).
    'Safia ABDELKRIM'        → ('ABDELKRIM', 'Safia')
    'Marie-Pierre ABIVEN'    → ('ABIVEN', 'Marie-Pierre')
    'Jean DA COSTA OLIVEIRA' → ('DA COSTA OLIVEIRA', 'Jean')
    """
    parts = nom_complet.strip().split()
    if not parts:
        return nom_complet.strip(), None
    nom_start = next((i for i, p in enumerate(parts) if _is_all_caps_token(p)), None)
    if nom_start is None:
        return nom_complet.strip(), None
    nom = " ".join(parts[nom_start:])
    prenom = " ".join(parts[:nom_start]) or None
    return nom, prenom


_RE_CP = re.compile(r"\b(\d{5})\b")


def parse_adresse(raw: str) -> dict:
    """
    '4 rue du Cloître de la Barge - 80000 AMIENS'
    → {rue, code_postal, ville, pays}.
    """
    raw = safe_str(raw)
    if not raw:
        return {}
    if " - " in raw:
        parts = raw.split(" - ", 1)
        rue = parts[0].strip() or None
        rest = parts[1].strip()
        m = _RE_CP.match(rest)
        if m:
            cp = m.group(1)
            ville = rest[m.end() :].strip() or None
            return {"rue": rue, "code_postal": cp, "ville": ville, "pays": "France"}
        return {"rue": rue, "pays": "France"}
    # Fallback si pas de tiret
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


def normalize_name(name: str) -> str:
    """Minuscules, sans accents, pour comparaison floue."""
    s = name.lower()
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"[^a-z0-9]", " ", s)
    return " ".join(s.split())


def load_csv(path: str) -> list[dict]:
    with open(path, encoding="utf-8-sig") as f:
        return list(csv.DictReader(f, delimiter=";"))


# =============================================================================
# IMPORTEUR
# =============================================================================


class BarreauAmiensImporter:
    def __init__(self):
        self.conn = None
        self.cursor = None
        self.stats = {
            "pp_creees": 0,
            "pp_ignorees": 0,
            "pp_doublons": 0,
            "adresses_creees": 0,
            "linking_domaine": 0,
            "erreurs": [],
        }
        # nom_complet → pp_id (uuid str)
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

    def _already_imported(self, source_id_externe: str) -> Optional[str]:
        source_id_externe = source_id_externe[:100]
        self.cursor.execute(
            """
            SELECT entite_crm_id FROM mapping_sources
            WHERE entite_crm = 'PersonnePhysique'
              AND source_nom = %s
              AND source_id_externe = %s
            """,
            (SOURCE_NOM, source_id_externe),
        )
        row = self.cursor.fetchone()
        return row["entite_crm_id"] if row else None

    def _find_existing_pp(self, nom: str, prenom: Optional[str]) -> Optional[str]:
        """Cherche une PP existante par nom + prénom pour éviter les doublons."""
        if prenom:
            self.cursor.execute(
                "SELECT id FROM personnes_physiques WHERE nom = %s AND prenom = %s LIMIT 1",
                (nom, prenom),
            )
        else:
            self.cursor.execute(
                "SELECT id FROM personnes_physiques WHERE nom = %s AND prenom IS NULL LIMIT 1",
                (nom,),
            )
        row = self.cursor.fetchone()
        return str(row["id"]) if row else None

    # -------------------------------------------------------------------------
    # PURGE
    # -------------------------------------------------------------------------

    def purge_data(self):
        logger.info("=== PHASE 0 : Purge des données Barreau d'Amiens ===")

        self.cursor.execute(
            "SELECT entite_crm_id FROM mapping_sources WHERE source_nom = %s",
            (SOURCE_NOM,),
        )
        rows = self.cursor.fetchall()
        pp_ids = [r["entite_crm_id"] for r in rows]

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
                "DELETE FROM personnes_physiques WHERE id = ANY(%s::uuid[])",
                (pp_ids,),
            )
            logger.info(f"  Supprimé {len(pp_ids)} PP")

        self.cursor.execute(
            "DELETE FROM mapping_sources WHERE source_nom = %s",
            (SOURCE_NOM,),
        )
        self.conn.commit()
        logger.info("✓ Purge terminée")

    # -------------------------------------------------------------------------
    # ADRESSES
    # -------------------------------------------------------------------------

    def _create_address(
        self, rue=None, code_postal=None, ville=None, pays="France"
    ) -> Optional[int]:
        if not any([rue, ville, code_postal]):
            return None
        self.cursor.execute(
            """
            INSERT INTO adresses
                (rue, code_postal, ville, pays, type_adresse, modifier_le)
            VALUES (%s, %s, %s, %s, 'SIEGE', NOW())
            RETURNING id
            """,
            (rue or None, code_postal or None, ville or None, pays),
        )
        self.stats["adresses_creees"] += 1
        return self.cursor.fetchone()["id"]

    # -------------------------------------------------------------------------
    # PHASE 1 — PP
    # -------------------------------------------------------------------------

    def create_pp(self, rows: list[dict]):
        logger.info("=== PHASE 1 : Création des Personnes Physiques ===")

        for row in rows:
            nom_complet = safe_str(row.get("Nom Complet"))
            if not nom_complet:
                continue

            self.cursor.execute("SAVEPOINT pp_insert")
            try:
                # Idempotence via mapping_sources
                existing_id = self._already_imported(nom_complet)
                if existing_id:
                    self.pp_map[nom_complet] = existing_id
                    self.stats["pp_ignorees"] += 1
                    self.cursor.execute("RELEASE SAVEPOINT pp_insert")
                    continue

                nom, prenom = parse_nom_prenom(nom_complet)

                # Anti-doublon : PP déjà en base avec même nom/prénom
                existing_id = self._find_existing_pp(nom, prenom)
                if existing_id:
                    self.pp_map[nom_complet] = existing_id
                    self._insert_mapping_source(
                        "PersonnePhysique", existing_id, nom_complet
                    )
                    self.stats["pp_doublons"] += 1
                    logger.info(
                        f"  PP existante réutilisée : {nom_complet!r} → id={existing_id}"
                    )
                    self.cursor.execute("RELEASE SAVEPOINT pp_insert")
                    continue

                # Email
                email_raw = safe_str(row.get("Email(s)", ""))
                emails_valides = [
                    normalize_email(e)
                    for e in split_semi(email_raw)
                    if normalize_email(e)
                ]
                email = " | ".join(emails_valides) if emails_valides else None

                # Téléphones
                tels = split_semi(safe_str(row.get("Téléphone(s)", "")))
                telephone = tels[0] if len(tels) >= 1 else None
                portable = tels[1] if len(tels) >= 2 else None

                # Adresse
                addr_id = None
                addr_raw = safe_str(row.get("Adresse(s)", ""))
                if addr_raw:
                    parsed = parse_adresse(addr_raw)
                    if parsed:
                        addr_id = self._create_address(
                            rue=parsed.get("rue"),
                            code_postal=parsed.get("code_postal"),
                            ville=parsed.get("ville"),
                            pays=parsed.get("pays", "France"),
                        )

                # Date serment
                date_serment = parse_date_serment(safe_str(row.get("Date serment", "")))

                # Insertion PP
                self.cursor.execute(
                    """
                    INSERT INTO personnes_physiques
                        (nom, prenom, email, telephone, portable,
                         type_profil_principal, type_relation_dossier,
                         adresse_id, actif, creer_par, modifier_par, modifier_le)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s,
                            true, 'import_barreau_amiens', 'import_barreau_amiens', NOW())
                    RETURNING id
                    """,
                    (
                        nom,
                        prenom,
                        email,
                        telephone,
                        portable,
                        TYPE_PROFIL,
                        "CONTACT",
                        addr_id,
                    ),
                )
                pp_id = str(self.cursor.fetchone()["id"])

                # Insertion profil_avocat
                self.cursor.execute(
                    """
                    INSERT INTO profil_avocat
                        (personne_physique_id, barreau, date_serment, profession, modifier_le)
                    VALUES (%s::uuid, %s, %s, %s, NOW())
                    """,
                    (pp_id, BARREAU, date_serment, "Avocat"),
                )

                self._insert_mapping_source("PersonnePhysique", pp_id, nom_complet)
                self.pp_map[nom_complet] = pp_id
                self.stats["pp_creees"] += 1

                self.cursor.execute("RELEASE SAVEPOINT pp_insert")

            except Exception as e:
                self.cursor.execute("ROLLBACK TO SAVEPOINT pp_insert")
                msg = f"Erreur PP {nom_complet!r}: {e}"
                logger.error(f"✗ {msg}")
                self.stats["erreurs"].append(msg)

        self.conn.commit()
        logger.info(
            f"✓ PP : {self.stats['pp_creees']} créées, "
            f"{self.stats['pp_ignorees']} déjà importées, "
            f"{self.stats['pp_doublons']} réutilisées (doublons évités)"
        )

    # -------------------------------------------------------------------------
    # PHASE 2 — LINKING PAR DOMAINE EMAIL
    # -------------------------------------------------------------------------

    def link_by_domain(self):
        logger.info("=== PHASE 2 : Linking PP → PM par domaine email ===")

        if not self.pp_map:
            return

        all_pp_ids = list(self.pp_map.values())

        # Index domaine → pm_id depuis les PM existantes
        self.cursor.execute(
            """
            SELECT id, nom_domaine FROM personnes_morales
            WHERE nom_domaine IS NOT NULL AND nom_domaine != ''
            """
        )
        domain_to_pm: dict[str, str] = {}
        for row in self.cursor.fetchall():
            for d in row["nom_domaine"].split():
                d = d.strip().lower()
                if d:
                    domain_to_pm[d] = str(row["id"])

        if not domain_to_pm:
            logger.info("  Aucune PM avec nom_domaine en base")
            return

        # Emails des PP importées
        self.cursor.execute(
            """
            SELECT id, email FROM personnes_physiques
            WHERE id = ANY(%s::uuid[]) AND email IS NOT NULL
            """,
            (all_pp_ids,),
        )
        pp_emails = {str(r["id"]): r["email"] for r in self.cursor.fetchall()}

        today = date.today()
        for pp_id, email_str in pp_emails.items():
            for email in (email_str or "").split(" | "):
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
                        WHERE personne_physique_id = %s::uuid
                          AND personne_morale_id = %s::uuid
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
                        VALUES (%s::uuid, %s::uuid, %s, %s, NULL, NOW())
                        """,
                        (pp_id, pm_id, "Avocat", today),
                    )
                    self.stats["linking_domaine"] += 1
                    self.cursor.execute("RELEASE SAVEPOINT link_domain")
                    break  # un seul rattachement par PP suffit

                except Exception as e:
                    self.cursor.execute("ROLLBACK TO SAVEPOINT link_domain")
                    logger.warning(f"  Erreur linking PP {pp_id} → PM {pm_id}: {e}")

        self.conn.commit()
        logger.info(
            f"✓ Linking domaine : {self.stats['linking_domaine']} rattachements créés"
        )

    # -------------------------------------------------------------------------
    # RAPPORT
    # -------------------------------------------------------------------------

    def log_report(self):
        logger.info("=" * 60)
        logger.info("RAPPORT FINAL — BARREAU D'AMIENS")
        logger.info("=" * 60)
        logger.info(f"  PP créées          : {self.stats['pp_creees']}")
        logger.info(
            f"  PP ignorées        : {self.stats['pp_ignorees']} (déjà importées)"
        )
        logger.info(
            f"  PP réutilisées     : {self.stats['pp_doublons']} (existantes, non dupliquées)"
        )
        logger.info(f"  Adresses créées    : {self.stats['adresses_creees']}")
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
        logger.info("=== IMPORT BARREAU D'AMIENS → CRM LX ===")

        rows = load_csv(CSV_PP)
        logger.info(f"  {len(rows)} entrées chargées depuis {os.path.basename(CSV_PP)}")

        self.connect()
        try:
            if _ARGS.purge:
                self.purge_data()
            self.create_pp(rows)
            self.link_by_domain()
        finally:
            self.disconnect()

        self.log_report()


if __name__ == "__main__":
    BarreauAmiensImporter().run()
