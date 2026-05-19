# CRM LX — POC

CRM interne Lexavoué : gestion des personnes physiques, personnes morales, dossiers et facturation. Ce dépôt est un POC pour valider l'architecture technique avant mise en production.

Déployé sur **Vercel** — une seule instance Next.js couvre le frontend et le backend.

---

## Table des matières

- [Architecture](#architecture)
- [Monter le projet](#monter-le-projet)
- [Bases de données](#bases-de-données)
- [Import des données Anaba](#import-des-données-anaba)

---

## Architecture

```
crm-poc/
├── apps/
│   └── crm-app/        ← Application Next.js (front + back)
└── data-scripts/       ← Scripts d'import de données (Python / uv)
```

### Principe général

Tout tourne dans une seule application Next.js pour permettre le déploiement gratuit sur Vercel. Le front et le back sont séparés **par convention de dossiers** plutôt que par processus distincts :

| Dossier | Rôle | Exécution |
|---|---|---|
| `app/api/` | Endpoints HTTP (route handlers) | Serveur (Vercel Functions) |
| `lib/server/` | Logique métier, accès Prisma | Serveur uniquement |
| `lib/client/` | Fetch wrappers vers `app/api/` | Navigateur |
| `app/(pages)/` | Pages et composants React | Navigateur + SSR |

La règle fondamentale : **`lib/server/` n'est jamais importé depuis un composant client.** Next.js garantit cet isolement via les directives `"use server"` / `"use client"`.

### Structure détaillée

```
apps/crm-app/
├── app/
│   ├── api/                              ← Backend : route handlers (minces, délèguent à lib/server)
│   │   ├── personnes-physiques/
│   │   │   ├── route.ts                  ← GET /api/personnes-physiques, POST
│   │   │   └── [id]/route.ts             ← GET /api/personnes-physiques/:id, PATCH, DELETE
│   │   ├── personnes-morales/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   ├── rattachements/route.ts
│   │   ├── dossiers/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   ├── segments/route.ts
│   │   └── auth/route.ts
│   └── (pages)/                          ← Frontend : pages et layouts
│
├── lib/
│   ├── server/                           ← Code server-only (jamais importé côté client)
│   │   ├── prisma.ts                     ← Singleton PrismaClient
│   │   └── modules/                      ← Un module par domaine métier
│   │       ├── personnes-physiques/
│   │       │   ├── service.ts            ← Requêtes Prisma, logique métier
│   │       │   └── dto.ts                ← Types entrée / sortie
│   │       ├── personnes-morales/
│   │       ├── rattachements/
│   │       ├── dossiers/
│   │       └── segments/
│   └── client/                           ← Fetch wrappers (un fichier par domaine)
│       ├── personnes-physiques.ts         ← fetch('/api/personnes-physiques', ...)
│       ├── personnes-morales.ts
│       ├── rattachements.ts
│       ├── dossiers.ts
│       └── segments.ts
│
└── prisma/                               ← Schéma et migrations Prisma
    ├── schema.prisma
    └── migrations/
```

### Flux d'une requête

```
Composant React (client)
  └─ lib/client/personnes-physiques.ts    ← fetch('/api/personnes-physiques')
       └─ app/api/personnes-physiques/route.ts   ← valide la requête
            └─ lib/server/modules/personnes-physiques/service.ts  ← requête Prisma
                 └─ PostgreSQL
```

### Base de données — Prisma

Modèles principaux :

| Modèle | Table | Rôle |
|---|---|---|
| `PersonneMorale` | `personnes_morales` | Entreprises, cabinets, groupes |
| `PersonnePhysique` | `personnes_physiques` | Contacts individuels |
| `RattachementPpPm` | `rattachements_pp_pm` | Lien N:N PP ↔ PM |
| `Dossier` | `dossiers` | Dossiers juridiques |
| `MappingSource` | `mapping_sources` | Traçabilité des imports externes |
| `JournalMigration` | `journal_migrations` | Historique des imports |

---

## Monter le projet

### Prérequis

- [Docker](https://www.docker.com/)
- [Node.js](https://nodejs.org/) ≥ 20
- [uv](https://docs.astral.sh/uv/) (Python, pour les scripts d'import)

### 1. Cloner et configurer les variables d'environnement

```bash
git clone <repo>
cd crm-poc
cp apps/crm-app/.env.example apps/crm-app/.env
cp data-scripts/.env.example data-scripts/.env
```

### 2. Démarrer les bases de données

```bash
# Base de dev (port 5440)
docker compose up db_finale -d

# Base de test (port 5441)
docker compose up db_test -d
```

### 3. Appliquer les migrations

```bash
cd apps/crm-app
npx prisma migrate deploy
```

### 4. Démarrer l'application

```bash
cd apps/crm-app
npm install
npm run dev    # http://localhost:3000
```

---

## Bases de données

| Env | Hôte | Port | User | Base |
|---|---|---|---|---|
| Dev | localhost | 5440 | `lx_dev` | `crm_dev` |
| Test | localhost | 5441 | `lx` | `crm_test` |

---

## Import des données Anaba

Les fichiers CSV Anaba sont à placer dans `data-scripts/data/anaba/`.

```bash
cd data-scripts

# Importer sur la base de TEST (défaut)
uv run python import_anaba.py

# Importer sur la base de DEV
uv run python import_anaba.py --dev
```

Les logs et rapports sont générés dans `data-scripts/output/` (ignoré par git).
