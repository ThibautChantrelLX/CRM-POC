# CRM LX — POC

CRM interne Lexavoué : gestion des personnes physiques, personnes morales, dossiers et facturation. Ce dépôt est un POC pour valider l'architecture technique avant mise en production.

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
│   ├── crm-app/        ← Frontend (Next.js)
│   ├── crm-api/        ← Backend (NestJS)
│   └── crm-shared/     ← Types & validateurs partagés (TypeScript)
└── data-scripts/       ← Scripts d'import de données (Python / uv)
```

### Principe général

Le projet suit une séparation stricte frontend / backend :

- **`crm-api`** expose une API REST. C'est le seul point d'accès à la base de données. Il est organisé en **modules NestJS** (un par domaine métier), chacun contenant son controller, son service et ses DTOs.
- **`crm-app`** est un frontend Next.js qui consomme l'API via le dossier `lib/api-client/`. Il ne touche jamais directement la base de données.
- **`crm-shared`** contient les types TypeScript et validateurs communs aux deux apps, pour éviter la duplication.
- **`data-scripts`** contient les scripts Python d'import (Anaba, Expert, etc.), indépendants du reste. Ils écrivent directement en base via psycopg2.

### Backend — NestJS (`crm-api`)

```
src/
├── main.ts                  ← Point d'entrée, bootstrap NestJS
├── app.module.ts            ← Module racine, importe tous les modules
├── config/                  ← ConfigModule (@nestjs/config), variables d'env
├── prisma/
│   ├── prisma.module.ts     ← Module global Prisma
│   └── prisma.service.ts    ← PrismaClient injecté dans tous les services
├── common/
│   ├── filters/             ← Exception filters (gestion d'erreurs globale)
│   ├── guards/              ← Guards d'authentification (JWT, rôles)
│   ├── interceptors/        ← Formatage uniforme des réponses
│   └── decorators/          ← Décorateurs custom (@CurrentUser, etc.)
└── modules/
    ├── auth/                ← Authentification (login, JWT)
    ├── personnes-physiques/ ← CRUD contacts
    ├── personnes-morales/   ← CRUD entreprises / cabinets
    ├── rattachements/       ← Liens PP ↔ PM
    ├── dossiers/            ← Dossiers juridiques
    └── segments/            ← Segmentation & ciblage
```

Chaque module respecte la même structure :

```
mon-module/
├── mon-module.module.ts      ← Déclare le controller et le service
├── mon-module.controller.ts  ← Routes HTTP, validation des entrées
├── mon-module.service.ts     ← Logique métier, appels Prisma
├── dto/                      ← Data Transfer Objects (entrée / sortie)
└── entities/                 ← Classes de réponse (swagger, sérialisation)
```

### Base de données — Prisma

Le schéma Prisma est dans `apps/crm-api/` (ou `apps/crm-app/prisma/` en attendant la migration). Les migrations SQL sont versionnées dans `prisma/migrations/`.

Modèles principaux :

| Modèle | Table | Rôle |
|---|---|---|
| `PersonneMorale` | `personnes_morales` | Entreprises, cabinets, groupes |
| `PersonnePhysique` | `personnes_physiques` | Contacts individuels |
| `RattachementPpPm` | `rattachements_pp_pm` | Lien N:N PP ↔ PM |
| `Dossier` | `dossiers` | Dossiers juridiques |
| `MappingSource` | `mapping_sources` | Traçabilité des imports externes |
| `JournalMigration` | `journal_migrations` | Historique des imports |

### Frontend — Next.js (`crm-app`)

Application Next.js (App Router). Consomme `crm-api` via `lib/api-client/`. Ne contient aucune logique métier ni accès direct à la base.

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

# Backend
cp apps/crm-api/.env.example apps/crm-api/.env

# Frontend
cp apps/crm-app/.env.example apps/crm-app/.env

# Scripts Python
cp data-scripts/.env.example data-scripts/.env
```

### 2. Démarrer les bases de données

```bash
# Base de test (port 5441) — utilisée par défaut pour les scripts
docker compose up db_test -d

# Base de dev (port 5440) — utilisée par crm-api et crm-app
docker compose up db_finale -d
```

### 3. Appliquer les migrations

```bash
cd apps/crm-app   # ou crm-api une fois le schéma déplacé
npx prisma migrate deploy
```

### 4. Démarrer le backend

```bash
cd apps/crm-api
npm install
npm run start:dev   # http://localhost:3001
```

### 5. Démarrer le frontend

```bash
cd apps/crm-app
npm install
npm run dev         # http://localhost:3000
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
