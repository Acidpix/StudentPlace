# StudentPlace

Application web de gestion des plans de classe, à destination des professeurs.

Composer un plan de classe à la main est fastidieux, et il faut tout recommencer
au moindre changement de salle. StudentPlace mémorise vos classes, vos salles et
vos contraintes, puis propose une disposition qui respecte deux règles que tout
professeur connaît : **les élèves les plus difficiles doivent être près du bureau
et à l'écart les uns des autres**, et **certains élèves ne doivent jamais être
voisins**.

---

## Fonctionnalités

- **Classes et élèves** — nom, prénom, commentaire, et une note de difficulté de
  1 à 5. Import d'une liste collée depuis un tableur.
- **Incompatibilités et affinités** — les paires d'élèves à séparer, et celles à
  rapprocher.
- **Besoins particuliers** — premier rang imposé (vue, audition), bout de table
  privilégié pour les gauchers.
- **Salles** — éditeur graphique : tables, bureau du professeur, tableau, porte,
  fenêtres. Rotation, annulation, duplication d'une salle.
- **Plans de classe** — une classe peut avoir plusieurs plans dans plusieurs
  salles ; une salle accueille plusieurs classes.
- **Placement automatique** — un solveur place les élèves selon les contraintes,
  et **dit ce qu'il n'a pas pu satisfaire** au lieu de produire un plan
  discrètement faux.
- **Placement manuel** — glisser-déposer, échange de deux élèves, verrouillage
  d'une place que le placement automatique ne touchera plus.
- **Alerte visuelle** — pastille de difficulté colorée *et chiffrée*, et
  avertissement rouge dès que deux élèves incompatibles sont trop proches.
- **Vue miroir** — bascule entre « vue depuis le bureau » et « vue depuis le
  fond », pour éviter le plan imprimé à l'envers.
- **Export PDF** — le plan à l'échelle avec le nom de la classe, celui de la
  salle et le nom des élèves, plus une liste alphabétique en annexe.
- **Thème sombre** — suit le réglage du système, ou se force à la main.
- **Espace personnel** — chaque professeur ne voit que ses propres données.

---

## Pile technique

| | |
|---|---|
| Cadre applicatif | Next.js 16 (App Router), React 19, TypeScript |
| Style | Tailwind CSS v4, `next-themes` |
| Base de données | SQLite via Prisma 7 (`@prisma/adapter-better-sqlite3`) |
| Authentification | Better Auth (e-mail + mot de passe) |
| Glisser-déposer | `@dnd-kit/core` |
| PDF | `@react-pdf/renderer`, rendu côté serveur |
| Tests | Vitest |

---

## Développement

Prérequis : **Node.js 22 ou plus récent** (24 LTS recommandé).

```bash
cp .env.example .env        # puis remplir les deux secrets ci-dessous
npm install                 # installe et génère le client Prisma
npm run db:push             # crée la base SQLite
npm run dev                 # http://localhost:3000
```

Générer les deux secrets requis dans `.env` :

```bash
openssl rand -base64 32     # pour BETTER_AUTH_SECRET
openssl rand -base64 32     # pour ENCRYPTION_KEY
```

Créez ensuite votre compte dans l'application, puis, si vous voulez un jeu
d'essai complet :

```bash
npm run db:seed             # une classe de 28 élèves et une salle de 32 places
```

Autres commandes :

```bash
npm run test                # tests unitaires (solveur, géométrie, CSV, chiffrement)
npm run typecheck           # vérification TypeScript
npm run db:studio           # explorateur de base Prisma
```

---

## Déploiement sur un serveur Linux

Testé sur Debian 12 et Ubuntu 24.04.

```bash
git clone https://github.com/Acidpix/StudentPlace.git studentplace
cd studentplace
sudo bash scripts/install.sh plans.mon-etablissement.fr
```

Le script installe Node 24, nginx et sqlite3, crée l'utilisateur système et les
dossiers, génère les secrets, construit l'application, installe le service
systemd et le proxy nginx, demande un certificat HTTPS à Let's Encrypt, et met
en place une sauvegarde quotidienne.

Le nom de domaine est facultatif : sans lui, nginx répond sur l'adresse IP, sans
HTTPS — à réserver à un réseau interne.

| | |
|---|---|
| Code | `/opt/studentplace` |
| Base de données | `/var/lib/studentplace/studentplace.db` |
| Sauvegardes | `/var/lib/studentplace/backups` (14 jours) |
| Service | `systemctl status studentplace` |
| Journaux | `journalctl -u studentplace -f` |

### Mise à jour

Le script récupère lui-même la dernière version depuis GitHub — inutile de
cloner quoi que ce soit à la main sur le serveur :

```bash
sudo bash /opt/studentplace/scripts/update.sh              # dernier état de main
sudo bash /opt/studentplace/scripts/update.sh v1.2.0       # une étiquette ou une branche
```

Le code est cloné dans un dossier temporaire puis recopié : `/opt/studentplace`
n'a jamais besoin d'être un dépôt Git, et `.env`, la base et `node_modules`
survivent à l'opération. Une sauvegarde est prise avant toute chose, et le
script s'interrompt en indiquant la commande de restauration si le service ne
redémarre pas.

Pour déployer depuis une copie locale plutôt que depuis GitHub — par exemple
pour essayer une modification avant de la pousser :

```bash
sudo LOCAL_DIR=/home/moi/studentplace bash /opt/studentplace/scripts/update.sh
```

Pour pointer vers un autre dépôt (fourche, miroir interne) :

```bash
sudo REPO_URL=https://git.interne.fr/studentplace.git bash /opt/studentplace/scripts/update.sh
```

### Sauvegarde et restauration

```bash
sudo -u studentplace bash scripts/backup.sh
sudo bash scripts/restore.sh /var/lib/studentplace/backups/studentplace-2026-08-14_033000.db.gz
```

La restauration met l'ancienne base de côté au lieu de l'écraser.

---

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | Chemin de la base SQLite (`file:/var/lib/studentplace/studentplace.db`) |
| `BETTER_AUTH_URL` | URL publique de l'application, sans slash final |
| `NEXT_PUBLIC_APP_URL` | Même valeur, accessible au navigateur |
| `BETTER_AUTH_SECRET` | Signature des sessions — 32 octets en base64 |
| `ENCRYPTION_KEY` | Chiffrement des commentaires — 32 octets en base64 |
| `PORT` | Port d'écoute du serveur Node (3000 par défaut) |

> **`ENCRYPTION_KEY` est irremplaçable.** Si vous la perdez ou la modifiez, tous
> les commentaires déjà enregistrés deviennent définitivement illisibles — le
> reste des données survit. Sauvegardez `/opt/studentplace/.env` au même titre
> que la base.

---

## Traitement des données

L'application enregistre des données personnelles de **mineurs**, assorties
d'appréciations comportementales. C'est un traitement sensible, et il est traité
comme tel :

- les commentaires sont **chiffrés au repos** (AES-256-GCM) ; une copie du
  fichier de base ne suffit pas à les lire ;
- chaque requête est filtrée par compte, y compris en forçant un identifiant
  dans l'URL ;
- les exports PDF **excluent par défaut** commentaires et notes de difficulté ;
- chaque professeur peut exporter l'intégralité de ses données ou supprimer son
  compte, avec effacement immédiat et en cascade ;
- aucune donnée ne quitte le serveur : aucun service tiers n'est appelé, et
  l'application demande explicitement aux moteurs de ne pas l'indexer.

Au sens du RGPD, le responsable de traitement reste **l'établissement ou le
professeur**, pas l'outil. Il vous revient de ne consigner que des observations
pertinentes et mesurées, et de supprimer les classes de l'année écoulée à la
rentrée suivante.

---

## Comment fonctionne le placement automatique

Le solveur (`src/lib/placement/solver.ts`) construit d'abord une disposition
raisonnable — les élèves les plus difficiles sur les places les plus proches du
bureau — puis l'améliore par **recuit simulé** : des échanges de places tirés au
hasard, conservés s'ils réduisent le coût, et parfois acceptés même s'ils
l'aggravent, ce qui permet d'échapper aux optima locaux. Plusieurs redémarrages
indépendants, on garde le meilleur.

Le coût agrège :

| Contrainte | Nature | Effet |
|---|---|---|
| Incompatibilité sous le seuil de proximité | dure | pénalité massive, croissante à mesure qu'ils se rapprochent |
| Élève devant être au premier rang | dure | pénalité massive hors du premier tiers |
| Difficulté élevée loin du bureau | souple | coût proportionnel à la difficulté et à la distance |
| Deux élèves difficiles voisins | souple | pénalité au produit de leurs difficultés |
| Élève difficile entouré de monde | souple | pénalité par voisin occupé |
| Affinité non satisfaite | souple | pénalité modérée |
| Gaucher hors bout de table | souple | pénalité faible |

Le calcul tourne dans un Web Worker, avec repli sur le fil principal si
l'empaquetage du worker échoue. Une même graine aléatoire redonne exactement le
même plan ; « Placer automatiquement » en tire une nouvelle à chaque appel.

Quand aucune disposition ne satisfait toutes les contraintes dures — deux élèves
incompatibles pour une seule table de deux, par exemple — le solveur renvoie un
**rapport de violations** affiché au professeur, plutôt qu'un plan faux présenté
comme valide.

---

## Structure du projet

```
prisma/schema.prisma          modèle de données
prisma/seed.ts                jeu de démonstration
src/app/(auth)/               connexion, inscription
src/app/(app)/                tableau de bord, classes, salles, plans, compte
src/app/api/                  authentification, export PDF, export RGPD
src/actions/                  Server Actions (toutes les écritures)
src/components/               interface, par domaine
src/lib/placement/            géométrie, solveur, détection de conflits
src/lib/pdf/                  document PDF
scripts/                      install, update, backup, restore
```

---

## Licence

Usage libre en contexte éducatif.
