# Data Scripts — Extraction & Import CRM LX

Scripts Python d'extraction des annuaires avocats et d'import dans le CRM.

## Convention de nommage des fichiers

Tous les fichiers CSV produits sont préfixés par la date d'extraction au format `YYYY-MM-DD` :

```
2026-06-17_extraction_barotech.csv
2026-06-17_extraction_barreau_amiens.csv
...
```

Quand le pipeline est lancé via `main.py`, la date est fixée une fois pour toutes au démarrage et partagée entre toutes les étapes (via la variable d'env `EXTRACTION_DATE`). Quand un script est lancé seul, il utilise la date du jour.

---

## Installation

```bash
cd data-scripts
uv sync          # installe les dépendances dans .venv
```

## Configuration

Créer un fichier `.env` à la racine de `data-scripts/` :

```env
# Base de TEST (port 5441) — cible par défaut des imports
TEST_DATABASE_URL=postgresql://user:password@localhost:5441/crm_test

# Base de DEV (port 5440) — utiliser avec --dev uniquement
DATABASE_URL=postgresql://user:password@localhost:5440/crm_dev

# Token Bearer Barreau de Paris (voir section BarreauParis)
BARREAU_PARIS_BEARER_TOKEN=...
```

---

## Pipelines d'extraction

### BarreauAmiens

Scraping public — aucune authentification requise.

```bash
# Extraction complète (~30 min selon la taille de l'annuaire)
uv run python BarreauAmiens/extract.py

# Test sur un seul nom
uv run python BarreauAmiens/extract.py --nom "MARTIN"

# Chemin de sortie personnalisé
uv run python BarreauAmiens/extract.py --output /tmp/amiens.csv

# Délai entre requêtes (défaut : 0.3 s)
uv run python BarreauAmiens/extract.py --delay 0.5
```

**Output :** `output/BarreauAmiens/YYYY-MM-DD_extraction_barreau_amiens.csv`

| Colonne | Description |
|---|---|
| Nom Complet | Nom et prénom |
| Barreau | "Barreau d'Amiens" |
| Téléphone(s) | Téléphone(s) du cabinet |
| Adresse(s) | Adresse du cabinet |
| Email(s) | Email décodé |
| Structure(s) | Cabinet de rattachement |
| Date serment | Date de prestation de serment |

---

### BarreauParis

API authentifiée — nécessite un Bearer token récupéré depuis les DevTools sur [avocatparis.org](https://www.avocatparis.org).

Le token peut être passé via `--token` ou la variable d'environnement `BARREAU_PARIS_BEARER_TOKEN`.

#### Étape 1 — Extraction

```bash
# Extraction complète (~15-30 min, ~30 000 avocats)
uv run python BarreauParis/extract.py --token "eyJ..."

# Via variable d'environnement
BARREAU_PARIS_BEARER_TOKEN="eyJ..." uv run python BarreauParis/extract.py

# Mode ciblé (test)
uv run python BarreauParis/extract.py --token "eyJ..." --nom "Dupont"
uv run python BarreauParis/extract.py --token "eyJ..." --spec 19
uv run python BarreauParis/extract.py --token "eyJ..." --act 5

# Lister les critères disponibles
uv run python BarreauParis/extract.py --list-criteria
```

**Output :** `output/BarreauParis/YYYY-MM-DD_extraction_barreau_paris.csv`

#### Étape 2 — Post-traitement (split PP / Structures + enrichissement SIRENE)

Prérequis : `YYYY-MM-DD_extraction_barreau_paris.csv` existant.

```bash
uv run python BarreauParis/post_process.py
```

**Outputs :**
- `output/BarreauParis/YYYY-MM-DD_extraction_barreau_paris_pp.csv` — contacts PP (avocats individuels)
- `output/BarreauParis/YYYY-MM-DD_extraction_structures_barreau_paris.csv` — structures enrichies SIRENE

#### Étape 3 — Enrichissement des fiches PP (structures, spécialités, date de serment)

```bash
uv run python BarreauParis/enrich_pp.py --token "eyJ..."

# Augmenter le parallélisme
uv run python BarreauParis/enrich_pp.py --token "eyJ..." --workers 10
```

**Output :** met à jour `YYYY-MM-DD_extraction_barreau_paris_pp.csv` sur place (colonnes `Activité(s) dominante(s)`, `Spécialité(s)`, `Date serment`, `Structure(s)`).

> Reprise automatique via checkpoint JSON — relancer la commande suffit en cas d'interruption.

---

### BarOtech

API Dynamics 365 Portal — nécessite trois paramètres récupérés depuis les DevTools sur [portail.barotech.fr](https://portail.barotech.fr) :

| Param | Header / Champ | Variable d'env |
|---|---|---|
| `--cookie` | Header `Cookie` | `BAROTECH_COOKIE` |
| `--token` | Header `__RequestVerificationToken` | `BAROTECH_TOKEN` |
| `--base64` | Champ `base64SecureConfiguration` du payload | `BAROTECH_BASE64` |

Ces valeurs s'obtiennent en inspectant une requête réseau vers `entity-grid-data.json` dans les DevTools.

#### Étape 1 — Extraction brute

```bash
uv run python BarOtech/extraction_barotech.py \
  --cookie "Dynamics365PortalAnalytics=..." \
  --token "0bLQUa..." \
  --base64 "2H1pgl..."
```

**Output :** `BarOtech/YYYY-MM-DD_extraction_barotech.csv` (~10 000 avocats)

#### Étape 2 — Enrichissement spécialités

```bash
uv run python BarOtech/enrich_specialites.py \
  --cookie "..." --token "..." --base64 "..."
```

**Input :** `YYYY-MM-DD_extraction_barotech.csv`
**Output :** `YYYY-MM-DD_extraction_barotech_specialities.csv`

#### Étape 3 — Enrichissement activités dominantes

```bash
uv run python BarOtech/enrich_activites.py \
  --cookie "..." --token "..." --base64 "..."
```

**Input :** `YYYY-MM-DD_extraction_barotech_specialities.csv`
**Output :** `YYYY-MM-DD_extraction_barotech_specialities_activites.csv`

#### Étape 4 — Enrichissement fiches individuelles (case + date de serment)

Seul le cookie est requis (scraping HTML, pas d'API JSON).

```bash
uv run python BarOtech/enrich_fiches.py --cookie "..."
```

**Input/Output :** `YYYY-MM-DD_extraction_barotech_specialities_activites.csv` (mise à jour sur place)

> Reprise automatique via `.YYYY-MM-DD_enrich_fiches_progress.csv` — relancer la commande suffit.

#### Étape 5 — Enrichissement structures via SIRENE

Aucune authentification — utilise l'API publique [recherche-entreprises.api.gouv.fr](https://recherche-entreprises.api.gouv.fr).

```bash
uv run python BarOtech/enrich_structures_sirene.py
```

**Input :** `YYYY-MM-DD_extraction_barotech_specialities_activites.csv`
**Output :** `YYYY-MM-DD_extraction_structures_sirene.csv`

---

## Scripts d'import

Les imports lisent des CSVs depuis `data/` et écrivent dans la base de données.
Par défaut ils ciblent la base de **TEST** (`TEST_DATABASE_URL`) — passer `--dev` pour la base de DEV.

```bash
# Barreau d'Amiens (PP uniquement)
uv run python import_barreau_amiens.py
uv run python import_barreau_amiens.py --purge   # purge puis re-import

# Barreau de Paris (PP + PM)
uv run python import_barreau_paris.py
uv run python import_barreau_paris.py --purge

# BarOtech (PP + PM + rattachements)
uv run python import_barotech.py

# Anaba (contacts + entreprises)
uv run python import_anaba.py

# Mise à jour des PM BarOtech avec données SIRENE enrichies
uv run python BarOtech/update_pm_sirene_enrichi.py

# Tous les flags acceptent --dev pour cibler la base de DEV
uv run python import_barotech.py --dev
```

> Les scripts d'import sont idempotents : ils s'appuient sur `mapping_sources` pour ne pas créer de doublons lors d'un re-lancement.

---

## Variables d'environnement (récapitulatif)

| Variable | Usage |
|---|---|
| `TEST_DATABASE_URL` | Cible par défaut des imports (base de test, port 5441) |
| `DATABASE_URL` | Cible avec `--dev` (base de dev, port 5440) |
| `BARREAU_PARIS_BEARER_TOKEN` | Token Bearer pour les scripts BarreauParis |
| `BAROTECH_COOKIE` | Cookie de session pour les scripts BarOtech |
| `BAROTECH_TOKEN` | `__RequestVerificationToken` pour les scripts BarOtech |
| `BAROTECH_BASE64` | Payload `base64SecureConfiguration` pour les scripts BarOtech |
