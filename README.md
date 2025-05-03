# Realtime Restaurant Backend API

Ce projet est une API backend pour un système de gestion de restaurant en temps réel, construit avec Encore.ts.

## Services

### Auth Service
Gère l'authentification et l'autorisation des utilisateurs du système (administrateurs, propriétaires et personnel).

#### Endpoints
- `POST /auth/register` - Enregistrement d'un nouvel utilisateur (admin, propriétaire ou personnel)
- `POST /auth/login` - Connexion d'un utilisateur
- `GET /auth/me` - Récupération des informations de l'utilisateur connecté
- `POST /auth/password-reset/request` - Demande de réinitialisation de mot de passe
- `POST /auth/password-reset/confirm` - Confirmation de réinitialisation de mot de passe
- `POST /auth/client` - Génération d'un ID client anonyme pour les clients du restaurant
- `POST /auth/client/:id/activity` - Mise à jour de l'activité d'un client

### Restaurant Service
Gère les informations des restaurants et leurs tables.

#### Endpoints
- `POST /restaurants` - Création d'un nouveau restaurant
- `GET /restaurants/:id` - Récupération des détails d'un restaurant
- `GET /restaurants/:id/tables` - Liste des tables d'un restaurant

### Menu Service
Gère le menu des restaurants, les catégories et les options.

#### Endpoints
- `POST /categories` - Création d'une nouvelle catégorie
- `GET /:restaurant_id/categories` - Liste des catégories d'un restaurant
- `POST /items` - Création d'un nouvel item de menu
- `GET /restaurants/:restaurant_id/menu-items` - Liste des items de menu d'un restaurant
- `POST /menu-items/:item_id/options` - Ajout d'une option à un item de menu
- `GET /menu-items/:item_id/options` - Liste des options d'un item de menu
- `POST /menu-items/:item_id/promotions` - Création d'une promotion pour un item
- `GET /restaurants/:restaurant_id/promotions` - Liste des promotions actives d'un restaurant

### Order Service
Gère les commandes et leur suivi en temps réel.

#### Endpoints
- `POST /orders` - Création d'une nouvelle commande
- `GET /orders/:id` - Récupération des détails d'une commande
- `POST /orders/:id/status` - Mise à jour du statut d'une commande
- `GET /orders/:id/items` - Liste des items d'une commande
- `GET /order-items/:item_id/options` - Liste des options d'un item de commande
- `GET /orders/:id/notifications` - Historique des notifications d'une commande
- `GET /restaurants/:restaurant_id/orders/stream` - WebSocket pour les mises à jour en temps réel
- `POST /orders/:order_id/review` - Soumission d'un avis pour une commande
- `GET /restaurant/:restaurant_id/reviews` - Liste des avis d'un restaurant

### Analytics Service
Fournit des statistiques et des métriques pour les restaurants.

#### Endpoints
- `GET /restaurants/:restaurant_id/stats` - Statistiques détaillées d'un restaurant
- `GET /restaurant/:id/metrics` - Métriques de performance d'un restaurant
- `GET /restaurant/:id/menu-metrics` - Métriques des items de menu
- `GET /restaurant/:id/processing-times` - Métriques des temps de traitement

## Installation

1. Cloner le repository
2. Installer les dépendances :
```bash
npm install
```

3. Configurer les variables d'environnement :
```bash
cp .env.example .env
```

4. Lancer l'application :
```bash
encore run
```

## Tests

Pour exécuter les tests :
```bash
npm test
```

## Documentation Swagger

La documentation Swagger est disponible à l'adresse `/swagger` lorsque l'application est en cours d'exécution.

## Architecture

Le projet suit une architecture microservices avec les services suivants :
- Auth : Gestion des utilisateurs authentifiés (admin, propriétaires, personnel) et des clients anonymes
- Restaurant : Gestion des restaurants et tables
- Menu : Gestion des menus et promotions
- Order : Gestion des commandes et avis
- Analytics : Statistiques et métriques

Chaque service a sa propre base de données PostgreSQL et communique avec les autres services via des appels API internes.

## Sécurité

- Les routes nécessitant une authentification sont protégées pour les utilisateurs du système (admin, propriétaires, personnel)
- Les clients peuvent accéder aux fonctionnalités publiques sans authentification
- Les tokens JWT sont utilisés pour l'authentification des utilisateurs du système
- Les mots de passe sont hachés avec bcrypt
- Les sessions utilisateur sont gérées de manière sécurisée

## Contribution

1. Fork le projet
2. Créer une branche pour votre fonctionnalité
3. Commiter vos changements
4. Pousser vers la branche
5. Ouvrir une Pull Request
