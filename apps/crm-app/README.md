# crm-app

Application Next.js du CRM LX. Contient le frontend et le backend dans une seule instance.

Voir le [README racine](../../README.md) pour la documentation complète (architecture, bases de données, authentification, démarrage du projet).

## Commandes utiles

```bash
# Développement
npm run dev

# Build de production
npm run build

# Vérification des types
npx tsc --noEmit

# Migrations Prisma
npx prisma migrate dev       # Crée une nouvelle migration (nécessite la shadow DB)
npx prisma migrate deploy    # Applique les migrations en attente
npx prisma studio            # Interface graphique d'exploration de la base

# Seed — créer un utilisateur
npx tsx prisma/seed_users.ts
```
