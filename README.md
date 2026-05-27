# CRM LX — POC

CRM interne Lexavoué : gestion des personnes physiques, personnes morales, dossiers et facturation. Ce dépôt est un POC pour valider l'architecture technique avant mise en production.

Déployé sur **Vercel** — une seule instance Next.js couvre le frontend et le backend.

---

## Table des matières

- [Architecture](#architecture)
- [Monter le projet](#monter-le-projet)
- [Bases de données](#bases-de-données)
- [Authentification & rôles](#authentification--rôles)
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
| `app/(pages)/` | Pages et composants — vue normale | Navigateur + SSR |
| `app/(admin)/` | Pages et composants — back-office | Navigateur + SSR |

La règle fondamentale : **`lib/server/` n'est jamais importé depuis un composant client.** Next.js garantit cet isolement via les directives `"use server"` / `"use client"`.

### Structure détaillée

```
apps/crm-app/
├── app/
│   ├── api/                              ← Backend : route handlers (minces, délèguent à lib/server)
│   │   ├── auth/[...all]/route.ts        ← Handler Better Auth (toutes les routes /api/auth/*)
│   │   ├── personnes-physiques/
│   │   │   ├── route.ts                  ← GET /api/personnes-physiques, POST
│   │   │   └── [id]/route.ts             ← GET /api/personnes-physiques/:id, PATCH, DELETE
│   │   ├── personnes-morales/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   ├── admin/
│   │   │   └── users/
│   │   │       ├── route.ts              ← POST (créer un utilisateur)
│   │   │       └── [id]/route.ts         ← PATCH, DELETE
│   │   ├── entites/route.ts              ← GET (liste des entités pour les selects)
│   │   ├── rattachements/route.ts
│   │   ├── dossiers/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   └── segments/route.ts
│   ├── (pages)/                          ← Layout avec Sidebar normale
│   │   ├── layout.tsx
│   │   ├── personnes-physiques/
│   │   └── personnes-morales/
│   └── (admin)/                          ← Layout avec AdminSidebar (back-office)
│       ├── layout.tsx
│       └── admin/
│           └── users/                    ← Liste, création, édition des utilisateurs
│
├── lib/
│   ├── server/                           ← Code server-only (jamais importé côté client)
│   │   ├── prisma.ts                     ← Singleton PrismaClient
│   │   ├── auth.ts                       ← Configuration Better Auth
│   │   ├── get-actor.ts                  ← Helper : résout le nom de l'utilisateur connecté
│   │   └── modules/                      ← Un module par domaine métier
│   │       ├── personnes-physiques/
│   │       │   ├── service.ts            ← Requêtes Prisma, logique métier
│   │       │   └── dto.ts                ← Types entrée / sortie
│   │       ├── personnes-morales/
│   │       ├── rattachements/
│   │       ├── dossiers/
│   │       ├── segments/
│   │       └── users/
│   │           └── service.ts            ← CRUD utilisateurs (Better Auth)
│   └── client/
│       ├── auth.ts                       ← Client Better Auth (useSession, signOut…)
│       ├── personnes-physiques.ts
│       └── …
│
├── components/
│   ├── layout/
│   │   └── Sidebar.tsx                   ← Sidebar principale (vue normale)
│   ├── admin/
│   │   ├── AdminSidebar.tsx              ← Sidebar back-office
│   │   ├── DataTable.tsx                 ← Table générique (tri, recherche, pagination)
│   │   ├── UserForm.tsx                  ← Formulaire création/édition utilisateur
│   │   └── UsersTable.tsx                ← Table des utilisateurs
│   └── pp/
│       └── PpForm.tsx                    ← Formulaire PP (multi-profil)
│
└── prisma/
    ├── schema.prisma
    ├── prisma.config.ts                  ← shadowDatabaseUrl pour migrate dev
    └── migrations/
```

### Flux d'une requête

```
Composant React (client)
  └─ lib/client/personnes-physiques.ts    ← fetch('/api/personnes-physiques')
       └─ app/api/personnes-physiques/route.ts   ← résout session (getActorName), valide
            └─ lib/server/modules/personnes-physiques/service.ts  ← requête Prisma
                 └─ PostgreSQL
```

### Base de données — Prisma

Modèles principaux :

| Modèle | Table | Rôle |
|---|---|---|
| `PersonneMorale` | `personnes_morales` | Entreprises, cabinets, groupes |
| `PersonnePhysique` | `personnes_physiques` | Contacts individuels |
| `ProfilAvocat` | `profil_avocat` | Données spécifiques avocat (barreau, serment…) |
| `ProfilPro` | `profil_pro` | Données spécifiques professionnel |
| `ProfilParticulier` | `profil_particulier` | Données spécifiques particulier |
| `RattachementPpPm` | `rattachements_pp_pm` | Lien N:N PP ↔ PM |
| `Dossier` | `dossiers` | Dossiers juridiques |
| `User` | `user` | Comptes utilisateurs (Better Auth) |
| `Session` | `session` | Sessions actives (Better Auth) |
| `Account` | `account` | Providers d'auth (Better Auth) |

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
cp apps/crm-app/.env.example apps/crm-app/.env.local
```

Variables obligatoires dans `.env.local` :

```env
DATABASE_URL=postgresql://lx:password@localhost:5441/crm_test
BETTER_AUTH_SECRET=<secret-aléatoire-long>
BETTER_AUTH_URL=http://localhost:3000
```

### 2. Démarrer les bases de données

```bash
# Base de travail (port 5441) — utilisée par l'application
docker compose up db_test -d

# Base de référence/backup (port 5440) — optionnelle
docker compose up db_finale -d
```

### 3. Appliquer les migrations

```bash
cd apps/crm-app
npx prisma migrate deploy
```

### 4. Créer le premier compte

Il n'y a pas d'interface de signup publique. Créer le premier SUPER_ADMIN directement via le script de seed ou l'admin en base :

```bash
cd apps/crm-app
npx tsx prisma/seed_users.ts
```

### 5. Démarrer l'application

```bash
cd apps/crm-app
npm install
npm run dev    # http://localhost:3000
```

---

## Bases de données

Deux bases PostgreSQL coexistent. L'application n'utilise qu'**une seule** à la fois, définie par `DATABASE_URL`.

| Rôle | Alias | Port | User | Base |
|---|---|---|---|---|
| **Travail (défaut)** | `db_test` | 5441 | `lx` | `crm_test` |
| Référence / backup | `db_finale` | 5440 | `lx_dev` | `crm_dev` |

### Pourquoi deux bases ?

- `crm_test` (port 5441) est la base active : toutes les migrations Prisma et les développements s'y appliquent en premier.
- `crm_dev` (port 5440) est conservée comme référence stable. Elle ne doit **jamais** recevoir de modifications directes — uniquement via un import contrôlé depuis `crm_test`.

### `prisma migrate dev` — shadow database

`prisma migrate dev` a besoin d'une base temporaire (shadow DB) pour détecter le drift. Elle est configurée dans `prisma.config.ts` :

```ts
shadowDatabaseUrl: "postgresql://lx:password@localhost:5441/crm_shadow"
```

La base `crm_shadow` doit exister (vide) sur le même serveur que `crm_test`. Elle est créée et détruite automatiquement par Prisma à chaque exécution de `migrate dev`.

---

## Authentification & rôles

### Stack

L'authentification est gérée par **[Better Auth](https://better-auth.com)**, une librairie open-source auto-hébergée (aucun compte externe nécessaire). Les sessions sont stockées en base PostgreSQL.

- Configuration : [`lib/server/auth.ts`](apps/crm-app/lib/server/auth.ts)
- Client React : [`lib/client/auth.ts`](apps/crm-app/lib/client/auth.ts)
- Route handler : `app/api/auth/[...all]/route.ts`

### Rôles

Chaque utilisateur possède un champ `role` sur le modèle `User` :

| Rôle | Description |
|---|---|
| `SUPER_ADMIN` | Accès complet, incluant la gestion des utilisateurs |
| `ADMIN` | Accès au back-office, peut créer et modifier des utilisateurs |
| `ASSOCIE` | Accès en lecture au back-office, pas de gestion des utilisateurs |
| `ACADEMIE` | Idem ASSOCIE |
| `USER` | Accès à la vue normale uniquement |

### Back-office (`/admin/*`)

Le back-office (gestion des utilisateurs) est accessible via l'icône ⚙ dans la sidebar. Il est visible pour les rôles `SUPER_ADMIN`, `ADMIN`, `ASSOCIE` et `ACADEMIE`.

La création et la modification d'utilisateurs sont réservées à `SUPER_ADMIN` et `ADMIN`.

### État actuel des guards

Les vérifications de rôle sont faites **manuellement** dans chaque page serveur et route API concernée. Il n'existe pas encore de middleware global de contrôle d'accès par rôle — c'est une amélioration prévue.

Le middleware actuel (`middleware.ts`) vérifie uniquement que l'utilisateur est **authentifié** (session valide) avant d'accéder à n'importe quelle page protégée. Les utilisateurs non connectés sont redirigés vers `/login`.

### Variables d'environnement liées à l'auth

```env
BETTER_AUTH_SECRET=   # Clé secrète pour signer les sessions (obligatoire)
BETTER_AUTH_URL=      # URL publique de l'app (ex: https://crm.lx.legal en prod)
```

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
