"""
=============================================================================
IMPORT ANABA → CRM LX
=============================================================================
Source  : Fichiers CSV Anaba (contacts + entreprises)
Cible   : PostgreSQL via .env

Exécution :
    uv run python import_anaba.py          # base de TEST (défaut)
    uv run python import_anaba.py --dev    # base de DEV
=============================================================================
"""

import argparse
import hashlib
import io
import json
import logging
import os
import re
from collections import defaultdict
from datetime import date, datetime
from typing import Optional

import pandas as pd
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()

# =============================================================================
# LOGGING
# =============================================================================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(
            os.path.join(
                os.path.dirname(os.path.abspath(__file__)), "output", "import_anaba.log"
            )
        ),
        logging.StreamHandler(),
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
DATA_DIR = os.path.join(_SCRIPT_DIR, "data", "anaba")
OUTPUT_DIR = os.path.join(_SCRIPT_DIR, "output")
os.makedirs(OUTPUT_DIR, exist_ok=True)
CSV_CONTACTS = os.path.join(DATA_DIR, "contacts_anaba_Lexavoue.csv")
CSV_ENTREPRISES = os.path.join(DATA_DIR, "companies_anaba_Lexavoue.csv")

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
}

# =============================================================================
# UTILITAIRES
# =============================================================================


def safe_str(val) -> str:
    if val is None:
        return ""
    if isinstance(val, float) and pd.isna(val):
        return ""
    return str(val).strip()


def normalize_company_name(name) -> str:
    """
    Normalise pour comparaison uniquement (clé de matching).
    Supprime 'avocat(s)' et les caractères spéciaux — le nom original est gardé en base.
    """
    s = safe_str(name)
    if not s:
        return ""
    s = re.sub(r"[^\w\s\-&().àâäéèêëïîôùûüœæ]", "", s, flags=re.UNICODE)
    s = s.upper()
    s = re.sub(r"\bAVOCATS?\b", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def normalize_email(val) -> str:
    s = safe_str(val).lower()
    return s if "@" in s else ""


def domain_from_email(val) -> Optional[str]:
    s = normalize_email(val)
    if not s:
        return None
    domain = s.split("@")[1].lower()
    return None if domain in _DOMAINES_GENERIQUES else domain


def domain_from_url(val) -> Optional[str]:
    s = safe_str(val)
    if not s:
        return None
    s = re.sub(r"^https?://", "", s, flags=re.IGNORECASE)
    s = re.sub(r"^www\.", "", s, flags=re.IGNORECASE)
    domain = s.split("/")[0].strip().lower()
    return domain if "." in domain else None


def compute_pm_domains(ent_row, addr_domain_map: dict) -> dict:
    """
    Répartit les domaines entre maison mère et bureaux.
    Retourne {None: 'dom1 dom2', addr_key: 'dom3', ...}
    """
    company_domains = set()
    d = domain_from_url(safe_str(ent_row.get("url")))
    if d:
        company_domains.add(d)
    d = domain_from_email(safe_str(ent_row.get("Email")))
    if d:
        company_domains.add(d)

    all_addr_keys = list(addr_domain_map.keys())
    result: dict = {}
    mm_domains = set(company_domains)

    if len(all_addr_keys) <= 1:
        for domains in addr_domain_map.values():
            mm_domains.update(domains)
    else:
        for domain in set(d for ds in addr_domain_map.values() for d in ds):
            if domain in company_domains:
                mm_domains.add(domain)
                continue
            addr_keys_with_domain = [
                ak for ak, ds in addr_domain_map.items() if domain in ds
            ]
            if len(addr_keys_with_domain) >= 2:
                mm_domains.add(domain)
            else:
                ak = addr_keys_with_domain[0]
                result.setdefault(ak, set()).add(domain)

    if mm_domains:
        result[None] = mm_domains

    return {k: " ".join(sorted(v)) for k, v in result.items()}


def parse_date(val) -> Optional[date]:
    s = safe_str(val)
    if not s:
        return None
    for fmt in ("%d/%m/%Y", "%d/%m/%y", "%m/%d/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    logger.warning(f"Format de date non reconnu: {s!r}")
    return None


def build_address_key(row) -> str:
    """Clé d'unicité d'adresse. Utilise les colonnes enrichies (clean*) en priorité."""
    ville = safe_str(row.get("cleanCity")) or safe_str(row.get("Ville")) or "UNKNOWN"
    cp = safe_str(row.get("cleanZipCode")) or safe_str(row.get("Code Postal"))
    rue = safe_str(row.get("cleanAddress")) or safe_str(row.get("Adresse"))
    return f"{ville}|{cp}|{rue}".upper()


def _short_hash(s: str) -> str:
    return hashlib.md5(s.encode()).hexdigest()[:8]


def load_csv(path: str) -> pd.DataFrame:
    with open(path, "rb") as f:
        content = f.read().replace(b"\x00", b"")
    return pd.read_csv(io.BytesIO(content), sep=";", encoding="utf-8-sig", dtype=str)


# =============================================================================
# CLASSE PRINCIPALE
# =============================================================================


class AnabaImporter:
    def __init__(self):
        self.conn = None
        self.cursor = None
        self.stats = {
            "pm_maisons_meres": 0,
            "pm_bureaux": 0,
            "pm_independantes": 0,
            "adresses_creees": 0,
            "pp_creees": 0,
            "rattachements_crees": 0,
            "doublons_pm_ignores": 0,
            "doublons_pp_ignores": 0,
            "pp_sans_rattachement": 0,
            "entreprises_inconnues": [],
            "erreurs": [],
        }
        # {norm_name → {'id': pm_id, 'bureaux': {addr_key: pm_id}}}
        self.pm_map: dict = {}
        # {company_csv_id → pm_id} — lookup direct via companyId du CSV contacts
        self.company_id_to_pm: dict = {}
        # PM indépendantes (contacts sans entreprise)
        self.domain_pm_map: dict = {}
        self.indiv_pm_map: dict = {}
        # {email → pp_id} + {(NOM, PRENOM) → pp_id}
        self.pp_map: dict = {}
        self.pp_map2: dict = {}

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
        """Enregistre ou met à jour un lien dans mapping_sources."""
        # Tronquer source_id_externe à 100 chars (contrainte VarChar)
        source_id_externe = source_id_externe[:100]
        self.cursor.execute(
            """
            INSERT INTO mapping_sources
                (entite_crm, entite_crm_id, source_nom, source_id_externe,
                 date_derniere_synchro)
            VALUES (%s, %s, 'ANABA', %s, NOW())
            ON CONFLICT (entite_crm, source_nom, source_id_externe)
            DO UPDATE SET
                entite_crm_id = EXCLUDED.entite_crm_id,
                date_derniere_synchro = NOW()
        """,
            (entite_crm, entite_crm_id, source_id_externe),
        )

    # -------------------------------------------------------------------------
    # PHASE 1 — PURGE via mapping_sources (idempotent)
    # -------------------------------------------------------------------------

    def purge_anaba_data(self):
        logger.info("=== PHASE 1: Purge des données ANABA via mapping_sources ===")

        self.cursor.execute("""
            SELECT entite_crm, entite_crm_id
            FROM mapping_sources
            WHERE source_nom = 'ANABA'
        """)
        rows = self.cursor.fetchall()

        pm_ids = [
            r["entite_crm_id"] for r in rows if r["entite_crm"] == "PersonneMorale"
        ]
        pp_ids = [
            r["entite_crm_id"] for r in rows if r["entite_crm"] == "PersonnePhysique"
        ]

        if not pm_ids and not pp_ids:
            logger.info("  Aucune donnée ANABA à purger (mapping_sources vide)")
            self.conn.commit()
            return

        logger.info(f"  {len(pm_ids)} PM et {len(pp_ids)} PP à purger")

        # Rattachements
        if pp_ids:
            self.cursor.execute(
                "DELETE FROM rattachements_pp_pm WHERE personne_physique_id = ANY(%s::uuid[])",
                (pp_ids,),
            )
            logger.info(f"  rattachements PP supprimés: {self.cursor.rowcount}")
        if pm_ids:
            self.cursor.execute(
                "DELETE FROM rattachements_pp_pm WHERE personne_morale_id = ANY(%s::uuid[])",
                (pm_ids,),
            )
            logger.info(f"  rattachements PM supprimés: {self.cursor.rowcount}")

        # Personnes physiques
        if pp_ids:
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
            logger.info(f"  personnes_physiques supprimées: {self.cursor.rowcount}")

        if pm_ids:
            # Collecter les adresses AVANT toute suppression
            self.cursor.execute(
                """
                SELECT adresse_id FROM personnes_morales
                WHERE id = ANY(%s) AND adresse_id IS NOT NULL
            """,
                (pm_ids,),
            )
            adresse_ids = [r["adresse_id"] for r in self.cursor.fetchall()]

            # Adresses des bureaux enfants (non forcément dans mapping_sources)
            self.cursor.execute(
                """
                SELECT adresse_id FROM personnes_morales
                WHERE maison_mere_id = ANY(%s) AND adresse_id IS NOT NULL
            """,
                (pm_ids,),
            )
            adresse_ids += [r["adresse_id"] for r in self.cursor.fetchall()]
            adresse_ids = list(set(adresse_ids))

            # Bureaux enfants d'abord (contrainte FK maison_mere_id)
            self.cursor.execute(
                """
                DELETE FROM personnes_morales WHERE maison_mere_id = ANY(%s)
            """,
                (pm_ids,),
            )
            logger.info(f"  bureaux enfants supprimés: {self.cursor.rowcount}")

            # Maisons mères et PM indépendantes
            self.cursor.execute(
                "DELETE FROM personnes_morales WHERE id = ANY(%s)", (pm_ids,)
            )
            logger.info(f"  PM (mères + indép) supprimées: {self.cursor.rowcount}")

            if adresse_ids:
                self.cursor.execute(
                    "DELETE FROM adresses WHERE id = ANY(%s)", (adresse_ids,)
                )
                logger.info(f"  adresses supprimées: {self.cursor.rowcount}")

        # Nettoyage mapping_sources
        self.cursor.execute("DELETE FROM mapping_sources WHERE source_nom = 'ANABA'")
        logger.info(f"  entrées mapping_sources supprimées: {self.cursor.rowcount}")

        self.conn.commit()
        logger.info("✓ Purge terminée")

    # -------------------------------------------------------------------------
    # PHASE 2 — ENTREPRISES
    # -------------------------------------------------------------------------

    def _create_address(self, row) -> Optional[int]:
        rue = safe_str(row.get("cleanAddress")) or safe_str(row.get("Adresse"))
        complement = safe_str(row.get("Complément d'adresse"))
        cp = safe_str(row.get("cleanZipCode")) or safe_str(row.get("Code Postal"))
        ville = safe_str(row.get("cleanCity")) or safe_str(row.get("Ville"))
        pays = (
            safe_str(row.get("cleanCountry")) or safe_str(row.get("Pays")) or "France"
        )

        if not any([rue, ville, cp]):
            return None

        self.cursor.execute(
            """
            INSERT INTO adresses
                (rue, complement_adresse, code_postal, ville, pays, type_adresse,
                 modifier_le)
            VALUES (%s, %s, %s, %s, %s, %s, NOW())
            RETURNING id
        """,
            (
                rue or None,
                complement or None,
                cp or None,
                ville or None,
                pays,
                "SIEGE",
            ),
        )
        self.stats["adresses_creees"] += 1
        return self.cursor.fetchone()["id"]

    def create_companies(self, df_contacts: pd.DataFrame, df_entreprises: pd.DataFrame):
        logger.info("=== PHASE 2: Création des entreprises ===")

        # Index entreprises par nom normalisé + par id CSV
        ref_entreprises: dict[str, dict] = {}
        ref_by_csv_id: dict[str, dict] = {}
        for _, row in df_entreprises.iterrows():
            csv_id = safe_str(row.get("id"))
            # La normalisation enlève "Avocats" pour le matching mais le nom
            # original (avec "Avocats") est conservé pour l'enregistrement en base
            norm = normalize_company_name(safe_str(row.get("name")))
            if not norm:
                continue
            row_dict = row.to_dict()
            if csv_id:
                ref_by_csv_id[csv_id] = row_dict
            if norm not in ref_entreprises:
                ref_entreprises[norm] = row_dict
            else:
                self.stats["doublons_pm_ignores"] += 1

        logger.info(
            f"  Entreprises uniques dans CSV entreprises: {len(ref_entreprises)}"
        )

        # Index adresses et domaines depuis les contacts, groupés par norm
        contact_addrs: dict = defaultdict(dict)
        contact_addr_domains: dict = defaultdict(lambda: defaultdict(set))
        for _, row in df_contacts.iterrows():
            norm = normalize_company_name(safe_str(row.get("Entreprise")))
            if not norm:
                continue
            has_addr = any(
                [
                    safe_str(row.get("cleanAddress")),
                    safe_str(row.get("Adresse")),
                    safe_str(row.get("cleanCity")),
                    safe_str(row.get("Ville")),
                    safe_str(row.get("cleanZipCode")),
                    safe_str(row.get("Code Postal")),
                ]
            )
            if has_addr:
                addr_key = build_address_key(row)
                if addr_key not in contact_addrs[norm]:
                    contact_addrs[norm][addr_key] = row.to_dict()
            domain = domain_from_email(safe_str(row.get("Email")))
            if domain:
                addr_key = build_address_key(row) if has_addr else "__NO_ADDR__"
                contact_addr_domains[norm][addr_key].add(domain)

        for norm, ent_row in ref_entreprises.items():
            self.cursor.execute("SAVEPOINT pm_insert")
            try:
                # Nom stocké en base tel quel (avec "Avocats" s'il est présent)
                original_name = safe_str(ent_row.get("name"))
                categorie = safe_str(ent_row.get("Catégorie Entreprise")) or None
                site_web = safe_str(ent_row.get("url")) or None
                csv_id = safe_str(ent_row.get("id"))

                addrs = contact_addrs.get(norm, {})
                nb_addrs = len(addrs)

                pm_domains = compute_pm_domains(
                    ent_row, dict(contact_addr_domains.get(norm, {}))
                )
                mm_domaine = pm_domains.get(None) or None

                adresse_siege_id = None
                if nb_addrs == 1:
                    adresse_siege_id = self._create_address(list(addrs.values())[0])
                if adresse_siege_id is None:
                    adresse_siege_id = self._create_address(ent_row)

                self.cursor.execute(
                    """
                    INSERT INTO personnes_morales
                        (raison_sociale, nom_domaine, type_lien_dossier,
                         source_origine, categorie_entreprise, site_web,
                         adresse_id, creer_par, modifier_par, modifier_le)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                    RETURNING id
                """,
                    (
                        original_name,
                        mm_domaine,
                        "CLIENT_DIRECT",
                        "ANABA",
                        categorie,
                        site_web,
                        adresse_siege_id,
                        "import_anaba",
                        "import_anaba",
                    ),
                )

                main_pm_id = self.cursor.fetchone()["id"]
                self.stats["pm_maisons_meres"] += 1

                if csv_id:
                    self._insert_mapping_source("PersonneMorale", main_pm_id, csv_id)

                bureaux_map = {}
                if nb_addrs >= 2:
                    for addr_key, contact_row in addrs.items():
                        ville_label = addr_key.split("|")[0].title() or "Bureau"
                        bureau_name = f"{original_name} — {ville_label}"
                        bureau_addr_id = self._create_address(contact_row)
                        bureau_domaine = pm_domains.get(addr_key) or None

                        self.cursor.execute(
                            """
                            INSERT INTO personnes_morales
                                (raison_sociale, nom_domaine, maison_mere_id,
                                 adresse_id, type_lien_dossier, source_origine,
                                 creer_par, modifier_par, modifier_le)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
                            RETURNING id
                        """,
                            (
                                bureau_name,
                                bureau_domaine,
                                main_pm_id,
                                bureau_addr_id,
                                "CLIENT_DIRECT",
                                "ANABA",
                                "import_anaba",
                                "import_anaba",
                            ),
                        )
                        bureau_id = self.cursor.fetchone()["id"]
                        bureaux_map[addr_key] = bureau_id
                        self.stats["pm_bureaux"] += 1

                        # Clé externe bureau : id_parent + hash de l'addr_key
                        bureau_ext_id = f"{csv_id}:b:{_short_hash(addr_key)}"
                        self._insert_mapping_source(
                            "PersonneMorale", bureau_id, bureau_ext_id
                        )

                self.cursor.execute("RELEASE SAVEPOINT pm_insert")
                self.pm_map[norm] = {"id": main_pm_id, "bureaux": bureaux_map}
                if csv_id:
                    self.company_id_to_pm[csv_id] = main_pm_id

            except Exception as e:
                self.cursor.execute("ROLLBACK TO SAVEPOINT pm_insert")
                msg = f"Erreur PM {safe_str(ent_row.get('name'))}: {e}"
                logger.error(f"✗ {msg}")
                self.stats["erreurs"].append(msg)

        self.conn.commit()
        total_pm = (
            self.stats["pm_maisons_meres"]
            + self.stats["pm_bureaux"]
            + self.stats["pm_independantes"]
        )
        logger.info(
            f"✓ {total_pm} PM créées "
            f"({self.stats['pm_maisons_meres']} maisons mères, "
            f"{self.stats['pm_bureaux']} bureaux)"
        )

    # -------------------------------------------------------------------------
    # PHASE 2b — PM INDÉPENDANTES (contacts sans entreprise)
    # -------------------------------------------------------------------------

    def create_independent_pms(self, df_contacts: pd.DataFrame):
        logger.info("=== PHASE 2b: PM indépendantes (contacts sans entreprise) ===")

        domain_rows: dict = defaultdict(list)
        individual_rows = []

        for _, row in df_contacts.iterrows():
            company_norm = normalize_company_name(safe_str(row.get("Entreprise")))
            if company_norm:
                continue
            domain = domain_from_email(safe_str(row.get("Email")))
            if domain:
                domain_rows[domain].append(row.to_dict())
            elif safe_str(row.get("Nom")):
                individual_rows.append(row.to_dict())

        for domain, rows in domain_rows.items():
            self.cursor.execute("SAVEPOINT indep_pm")
            try:
                self.cursor.execute(
                    """
                    INSERT INTO personnes_morales
                        (raison_sociale, nom_domaine, type_lien_dossier,
                         type_structure, source_origine, creer_par, modifier_par,
                         modifier_le)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
                    RETURNING id
                """,
                    (
                        domain,
                        domain,
                        "CLIENT_DIRECT",
                        "DOMAINE",
                        "ANABA",
                        "import_anaba",
                        "import_anaba",
                    ),
                )
                pm_id = self.cursor.fetchone()["id"]
                self.cursor.execute("RELEASE SAVEPOINT indep_pm")
                self._insert_mapping_source("PersonneMorale", pm_id, f"domain:{domain}")
                self.domain_pm_map[domain] = pm_id
                self.stats["pm_independantes"] += 1
            except Exception as e:
                self.cursor.execute("ROLLBACK TO SAVEPOINT indep_pm")
                self.stats["erreurs"].append(f"PM indep domaine {domain}: {e}")

        for row in individual_rows:
            nom = safe_str(row.get("Nom"))
            prenom = safe_str(row.get("Prénom"))
            key = (nom.upper(), prenom.upper())
            if key in self.indiv_pm_map:
                continue
            full_name = (
                f"{prenom.capitalize()} {nom.upper()}".strip()
                if prenom
                else nom.upper()
            )
            pm_name = f"[INDEPENDANT] {full_name}"
            self.cursor.execute("SAVEPOINT indiv_pm")
            try:
                self.cursor.execute(
                    """
                    INSERT INTO personnes_morales
                        (raison_sociale, type_lien_dossier, type_structure,
                         source_origine, creer_par, modifier_par, modifier_le)
                    VALUES (%s, %s, %s, %s, %s, %s, NOW())
                    RETURNING id
                """,
                    (
                        pm_name,
                        "CLIENT_DIRECT",
                        "INDEPENDANT",
                        "ANABA",
                        "import_anaba",
                        "import_anaba",
                    ),
                )
                pm_id = self.cursor.fetchone()["id"]
                self.cursor.execute("RELEASE SAVEPOINT indiv_pm")
                ext_id = f"indiv:{_short_hash(f'{nom.upper()}:{prenom.upper()}')}"
                self._insert_mapping_source("PersonneMorale", pm_id, ext_id)
                self.indiv_pm_map[key] = pm_id
                self.stats["pm_independantes"] += 1
            except Exception as e:
                self.cursor.execute("ROLLBACK TO SAVEPOINT indiv_pm")
                self.stats["erreurs"].append(f"PM indiv {pm_name}: {e}")

        self.conn.commit()
        logger.info(
            f"✓ {self.stats['pm_independantes']} PM indépendantes créées "
            f"({len(domain_rows)} par domaine, {len(individual_rows)} individuelles)"
        )

    # -------------------------------------------------------------------------
    # PHASE 3 — PERSONNES PHYSIQUES
    # -------------------------------------------------------------------------

    def create_persons(self, df_contacts: pd.DataFrame):
        logger.info("=== PHASE 3: Création des personnes physiques ===")

        for idx, row in df_contacts.iterrows():
            nom = safe_str(row.get("Nom"))
            prenom = safe_str(row.get("Prénom")) or None
            if not nom:
                continue

            contact_csv_id = safe_str(row.get("id"))
            email = normalize_email(safe_str(row.get("Email"))) or None
            telephone = safe_str(row.get("Téléphone")) or None
            portable = safe_str(row.get("Portable")) or None
            # linkedin_url reste VarChar(255) dans le schema
            linkedin_url = safe_str(row.get("Profil Linkedin")) or None
            if linkedin_url and len(linkedin_url) > 255:
                linkedin_url = linkedin_url[:255]

            statut_rgpd_raw = safe_str(row.get("Statut RGPD"))
            if statut_rgpd_raw == "Opt-in":
                statut_rgpd = "OPT_IN"
            elif statut_rgpd_raw == "Opt-out":
                statut_rgpd = "OPT_OUT"
            else:
                statut_rgpd = "NON_RENSEIGNE"
            opt_in_email = statut_rgpd != "OPT_OUT"

            # emailStatus: 'Oui' = email invalide
            email_invalide = safe_str(row.get("emailStatus")).lower() == "oui"

            dernier_email_le = parse_date(safe_str(row.get("lastEmailOn")))
            dernier_email_avec = safe_str(row.get("lastEmailBy")) or None
            echanges_avec = safe_str(row.get("activitiesWith")) or None

            total_raw = safe_str(row.get("totalEmails"))
            total_emails = int(float(total_raw)) if total_raw else 0

            self.cursor.execute("SAVEPOINT pp_insert")
            try:
                self.cursor.execute(
                    """
                    INSERT INTO personnes_physiques
                        (nom, prenom, email, telephone, portable,
                         linkedin_url,
                         statut_rgpd, email_invalide,
                         dernier_email_le, dernier_email_avec,
                         total_emails, echanges_avec,
                         type_profil_principal, type_relation_dossier, opt_in_email,
                         creer_par, modifier_par, modifier_le)
                    VALUES
                        (%s, %s, %s, %s, %s,
                         %s,
                         %s, %s,
                         %s, %s,
                         %s, %s,
                         'CONTACT_PRO', %s, %s,
                         %s, %s, NOW())
                    RETURNING id
                """,
                    (
                        nom,
                        prenom,
                        email,
                        telephone,
                        portable,
                        linkedin_url,
                        statut_rgpd,
                        email_invalide,
                        dernier_email_le,
                        dernier_email_avec,
                        total_emails,
                        echanges_avec,
                        "CONTACT",
                        opt_in_email,
                        "import_anaba",
                        "import_anaba",
                    ),
                )

                pp_id = self.cursor.fetchone()["id"]
                self.cursor.execute("RELEASE SAVEPOINT pp_insert")
                self.stats["pp_creees"] += 1

                if contact_csv_id:
                    self._insert_mapping_source(
                        "PersonnePhysique", pp_id, contact_csv_id
                    )
                if email:
                    self.pp_map[email] = pp_id
                self.pp_map2[(nom.upper(), (prenom or "").upper())] = pp_id

            except psycopg2.errors.UniqueViolation:
                self.cursor.execute("ROLLBACK TO SAVEPOINT pp_insert")
                self.stats["doublons_pp_ignores"] += 1
                if email:
                    self.cursor.execute(
                        "SELECT id FROM personnes_physiques WHERE email = %s",
                        (email,),
                    )
                    db_row = self.cursor.fetchone()
                    if db_row:
                        self.pp_map[email] = db_row["id"]
            except Exception as e:
                self.cursor.execute("ROLLBACK TO SAVEPOINT pp_insert")
                msg = f"Erreur PP ligne {idx} ({nom}): {e}"
                logger.error(f"✗ {msg}")
                self.stats["erreurs"].append(msg)

        self.conn.commit()
        logger.info(
            f"✓ {self.stats['pp_creees']} PP créées "
            f"({self.stats['doublons_pp_ignores']} doublons ignorés)"
        )

    # -------------------------------------------------------------------------
    # PHASE 4 — RATTACHEMENTS PP ↔ PM
    # -------------------------------------------------------------------------

    def create_rattachements(self, df_contacts: pd.DataFrame):
        logger.info("=== PHASE 4: Création des rattachements PP ↔ PM ===")

        for idx, row in df_contacts.iterrows():
            email = normalize_email(safe_str(row.get("Email")))
            nom = safe_str(row.get("Nom")).upper()
            prenom = safe_str(row.get("Prénom")).upper()

            pp_id = self.pp_map.get(email) or self.pp_map2.get((nom, prenom))
            if pp_id is None:
                continue

            company_str = safe_str(row.get("Entreprise"))
            company_norm = normalize_company_name(company_str)
            company_csv_id = safe_str(row.get("companyId"))

            if not company_norm:
                domain = domain_from_email(safe_str(row.get("Email")))
                pm_id = self.domain_pm_map.get(domain) or self.indiv_pm_map.get(
                    (nom, prenom)
                )
                if pm_id is None:
                    self.stats["pp_sans_rattachement"] += 1
                    continue
            else:
                # Lookup par companyId CSV d'abord (plus fiable), puis par nom normalisé
                if company_csv_id and company_csv_id in self.company_id_to_pm:
                    pm_id = self.company_id_to_pm[company_csv_id]
                else:
                    pm_entry = self.pm_map.get(company_norm)
                    if pm_entry is None:
                        if company_str not in self.stats["entreprises_inconnues"]:
                            self.stats["entreprises_inconnues"].append(company_str)
                        continue
                    if pm_entry["bureaux"]:
                        addr_key = build_address_key(row)
                        pm_id = pm_entry["bureaux"].get(addr_key, pm_entry["id"])
                    else:
                        pm_id = pm_entry["id"]

            poste = safe_str(row.get("Poste")) or "Professionnel du droit"
            titre_fonction = poste[:100]
            date_debut = parse_date(safe_str(row.get("createdOn"))) or date.today()

            self.cursor.execute("SAVEPOINT ratt_insert")
            try:
                self.cursor.execute(
                    """
                    INSERT INTO rattachements_pp_pm
                        (personne_physique_id, personne_morale_id,
                         titre_fonction, date_debut, modifier_le)
                    VALUES (%s, %s, %s, %s, NOW())
                """,
                    (pp_id, pm_id, titre_fonction, date_debut),
                )
                self.cursor.execute("RELEASE SAVEPOINT ratt_insert")
                self.stats["rattachements_crees"] += 1

            except Exception as e:
                self.cursor.execute("ROLLBACK TO SAVEPOINT ratt_insert")
                msg = f"Erreur rattachement ligne {idx}: {e}"
                logger.error(f"✗ {msg}")
                self.stats["erreurs"].append(msg)

        self.conn.commit()
        logger.info(f"✓ {self.stats['rattachements_crees']} rattachements créés")

    # -------------------------------------------------------------------------
    # PHASE 5 — JOURNAL + RAPPORT
    # -------------------------------------------------------------------------

    def log_migration(self):
        stats_journal = {
            "pm_maisons_meres": self.stats["pm_maisons_meres"],
            "pm_bureaux": self.stats["pm_bureaux"],
            "pm_independantes": self.stats["pm_independantes"],
            "adresses_creees": self.stats["adresses_creees"],
            "pp_creees": self.stats["pp_creees"],
            "rattachements_crees": self.stats["rattachements_crees"],
            "doublons_pm": self.stats["doublons_pm_ignores"],
            "doublons_pp": self.stats["doublons_pp_ignores"],
            "nb_erreurs": len(self.stats["erreurs"]),
        }
        self.cursor.execute(
            """
            INSERT INTO journal_migrations
                (nom_logiciel, perimetre, date_migration, termine_le,
                 statut, stats, execute_par)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """,
            (
                "ANABA",
                "ALL",
                datetime.now(),
                datetime.now(),
                "SUCCES" if not self.stats["erreurs"] else "PARTIEL",
                json.dumps(stats_journal),
                "import_anaba",
            ),
        )
        self.conn.commit()

    def generate_report(self):
        total_pm = (
            self.stats["pm_maisons_meres"]
            + self.stats["pm_bureaux"]
            + self.stats["pm_independantes"]
        )
        report = f"""
╔═══════════════════════════════════════════════════════╗
║  RAPPORT D'IMPORT ANABA → CRM LX                      ║
║  {datetime.now().strftime("%d/%m/%Y %H:%M:%S")}                             ║
╚═══════════════════════════════════════════════════════╝

PERSONNES MORALES
  Maisons mères :        {self.stats["pm_maisons_meres"]}
  Bureaux :              {self.stats["pm_bureaux"]}
  PM indépendantes :     {self.stats["pm_independantes"]}
  Total PM :             {total_pm}
  Adresses créées :      {self.stats["adresses_creees"]}
  Doublons ignorés :     {self.stats["doublons_pm_ignores"]}

PERSONNES PHYSIQUES
  PP créées :            {self.stats["pp_creees"]}
  Doublons ignorés :     {self.stats["doublons_pp_ignores"]}
  Rattachements :        {self.stats["rattachements_crees"]}
  PP sans rattachement : {self.stats["pp_sans_rattachement"]}

ANOMALIES
  Entreprises inconnues: {len(self.stats["entreprises_inconnues"])}
  Erreurs :              {len(self.stats["erreurs"])}

Fichier log : output/import_anaba.log
"""
        logger.info(report)

        report_path = os.path.join(OUTPUT_DIR, "import_anaba_report.json")
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(self.stats, f, indent=2, default=str, ensure_ascii=False)

        logger.info(f"✓ Rapport JSON : {report_path}")

    # -------------------------------------------------------------------------
    # MAIN
    # -------------------------------------------------------------------------

    def run(self):
        try:
            self.connect()

            logger.info("Chargement des fichiers CSV...")
            df_contacts = load_csv(CSV_CONTACTS)
            df_entreprises = load_csv(CSV_ENTREPRISES)
            logger.info(
                f"  {len(df_contacts)} contacts | {len(df_entreprises)} entreprises"
            )

            self.purge_anaba_data()
            self.create_companies(df_contacts, df_entreprises)
            self.create_independent_pms(df_contacts)
            self.create_persons(df_contacts)
            self.create_rattachements(df_contacts)
            self.log_migration()
            self.generate_report()

            logger.info("✅ IMPORT TERMINÉ AVEC SUCCÈS")

        except Exception as e:
            logger.error(f"❌ ERREUR CRITIQUE: {e}", exc_info=True)
            if self.conn:
                self.conn.rollback()
            raise
        finally:
            self.disconnect()


if __name__ == "__main__":
    AnabaImporter().run()
