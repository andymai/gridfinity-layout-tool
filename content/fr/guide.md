---
title: Comment planifier un tiroir Gridfinity
description: Guide pratique pour planifier des layouts de tiroir Gridfinity. Mesurez votre tiroir, déterminez les bins nécessaires et exportez une liste d’impression.
keywords: gridfinity planificateur, gridfinity layout, comment planifier gridfinity, organiser tiroir, guide gridfinity
schema: HowTo
breadcrumbs:
  - name: Accueil
    url: https://gridfinitylayouttool.com/
  - name: Guide de planification
    url: https://gridfinitylayouttool.com/fr/guide
faqs:
  - q: Comment mesurer un tiroir pour Gridfinity ?
    a: Mesurez les dimensions intérieures du tiroir en millimètres — largeur (gauche à droite), profondeur (avant à arrière) et hauteur libre (du fond au plafond du tiroir fermé). Prenez plusieurs mesures, les tiroirs étant rarement parfaitement rectangulaires, et retenez la plus petite valeur par dimension pour être sûr.
  - q: Comment convertir les dimensions du tiroir en unités de grille Gridfinity ?
    a: Divisez chaque dimension par 42 mm et arrondissez vers le bas. Par exemple, un tiroir de 380 mm × 260 mm accepte une grille 9×6 (378 mm × 252 mm), avec de petits écarts sur les bords. Les écarts ne sont pas un problème — les plaques de base n’ont pas besoin de remplir chaque millimètre.
  - q: Quelles tailles de bins choisir pour Gridfinity ?
    a: Comme point de départ — 1×1 avec séparateurs pour petites vis et composants ; 1×2 ou 2×2 pour stylos, clés USB et piles ; 1×3 ou 1×4 pour tournevis et pinces ; 2×2 ou 2×3 pour adhésif et tubes de colle ; 3×3 ou plus pour les gros outils. Vous pourrez toujours imprimer d’autres tailles plus tard si quelque chose ne va pas.
  - q: Quelle hauteur maximale pour un bin Gridfinity ?
    a: La hauteur n’est limitée que par la hauteur libre de votre tiroir et la course Z de votre imprimante. Les hauteurs se mesurent en unités de 7 mm (U). Un bin 6U fait 42 mm de haut intérieurement, un 9U fait 63 mm. Vérifiez votre bin le plus haut plus 5 mm pour la plaque face à la hauteur du tiroir fermé avant d’imprimer.
  - q: Faut-il utiliser plusieurs couches dans les tiroirs profonds ?
    a: Oui, si la hauteur le permet. Empilez les bins verticalement, la couche 1 en bas. Mettez le lourd en bas, le fréquent en haut. Très utile pour séparer objets plats (câbles) et bins hauts, ou pour isoler l’électrique du mécanique.
  - q: Comment exporter une liste d’impression Gridfinity ?
    a: Une fois votre layout terminé, la liste d’impression montre chaque taille de bin, la quantité nécessaire, les estimations de filament en grammes et des liens de recherche par taille sur Printables, Thangs et MakerWorld. Vous pouvez aussi générer des bins personnalisés directement avec le générateur intégré et exporter en STL, STEP ou 3MF.
  - q: Combien d’espace vide laisser dans un tiroir Gridfinity ?
    a: Laissez 10 à 20 % d’espace libre. Un tiroir planifié à 100 % aujourd’hui devient un problème demain, dès que votre collection grandit ou que les besoins changent. Les cases vides ne coûtent rien et laissent de la marge.
  - q: Quelle est la meilleure imprimante pour Gridfinity ?
    a: Toute imprimante FDM avec au moins 256 mm × 256 mm de plateau imprime les bins Gridfinity confortablement. Les Bambu Lab X1, A1 et P1S sont populaires pour leur vitesse. Prusa MK4 et Ender 3 V3 KE marchent bien aussi. Pour les tiroirs au-delà de 6×6 unités, soit vous carrelez les plaques de base, soit vous prenez un grand format type Bambu X1E ou Voron 2.4.
---

# Comment planifier un tiroir Gridfinity

Imprimer sans plan, c’est gaspiller du filament. Vous finissez par réimprimer des bins parce que vous vous êtes trompé sur les tailles, vous laissez des trous non voulus, ou vous oubliez ce qu’il fallait. Ce guide couvre comment mesurer, planifier et obtenir une liste d’impression avant de démarrer.

## Mesurer votre tiroir

Récupérez les dimensions intérieures en millimètres. Il vous faut :

- **Largeur** — gauche à droite
- **Profondeur** — avant à arrière
- **Hauteur** — du fond au plafond (hauteur libre tiroir fermé)

Mesurez à plusieurs endroits. Les tiroirs sont rarement de parfaits rectangles, surtout dans les meubles anciens. Prenez la plus petite valeur pour être sûr.

### Convertir en unités de grille

Gridfinity utilise des unités de 42 mm. Divisez et arrondissez vers le bas :

```text
Largeur :    380 mm ÷ 42 = 9,04 → 9 unités
Profondeur : 260 mm ÷ 42 = 6,19 → 6 unités
```

Une grille 9×6 fait 378 mm × 252 mm. Vous aurez de petits écarts sur les bords — c’est sans importance. Les plaques de base n’ont pas besoin de couvrir chaque millimètre.

## Déterminer ce qui rentre dedans

C’est l’étape que tout le monde saute, et que tout le monde regrette.

Videz complètement le tiroir. Regroupez :

- Le quotidien
- L’hebdomadaire
- Les trucs que vous aviez oubliés

Le quotidien doit être accessible. L’hebdomadaire peut aller au fond. Les oubliés n’ont peut-être pas besoin d’un bin du tout.

### Faire correspondre objets et tailles de bin

Repères :

| Contenu                   | Taille de bin        |
| ------------------------- | -------------------- |
| Vis M3, petits composants | 1×1 avec séparateurs |
| Stylos, clés USB, piles   | 1×2 ou 2×2           |
| Tournevis, pinces         | 1×3 ou 1×4           |
| Adhésif, colle            | 2×2 ou 2×3           |
| Gros outils               | 3×3 ou plus          |

Ne vous obsédez pas — vous pourrez toujours imprimer d’autres bins plus tard.

## Planifier le layout

Ouvrez l’outil et fixez la taille de la grille. Glissez pour créer des bins. L’outil empêche les chevauchements et les débordements.

**Le fréquent vers l’avant.** Quand vous ouvrez le tiroir, qu’est-ce que vous attrapez en premier ? Ça va devant.

**Regroupez par usage.** Tournevis à un endroit, outils de mesure à un autre. Vous vous souviendrez plus facilement.

**Laissez du vide.** Votre collection va grandir. Un tiroir planifié à 100 % aujourd’hui est un problème demain.

### Couches pour tiroirs profonds

Si vous avez de la hauteur, vous pouvez empiler les bins verticalement. La couche 1 est en bas.

Bien adapté à :

- Plat en bas (câbles, petites pièces), bins hauts au-dessus
- Séparer électrique et mécanique

Le lourd en bas, le fréquent en haut.

## Exporter votre liste d’impression

Quand le layout vous convient, exportez une liste d’impression :

- Chaque taille de bin et la quantité
- Estimations de filament en grammes
- Liens de recherche par taille

### Trouver des fichiers STL

Vous pouvez [générer des bins personnalisés](/fr/gridfinity-bin-generator) directement avec le générateur intégré — choisissez vos dimensions, le style de base, les compartiments, puis exportez en STL, STEP ou 3MF.

Pour les bins spécialisés (porte-outils spécifiques, formes complexes), parcourez les dépôts communautaires :

- [Printables](https://www.printables.com/search/models?q=gridfinity) — plus large sélection
- [Thangs](https://thangs.com/search/gridfinity) — utile pour trouver des designs similaires
- [MakerWorld](https://makerworld.com/en/search/models?keyword=gridfinity) — communauté Bambu Lab

Exemple de recherche : « gridfinity 2x2 3U » trouve des bins 2×2 de 3 unités de hauteur.

## Avant d’imprimer

### Testez d’abord en carton

> Découpez du carton aux tailles de vos bins (42 mm par unité de grille) et disposez-les dans le tiroir. Si quelque chose cloche, vous n’avez pas perdu de filament.

### Imprimez un bin d’abord

Avant d’en imprimer 20, imprimez-en un. Vérifiez l’ajustement, la hauteur, et confirmez que le design vous plaît. Ajustez les réglages d’impression si besoin.

### Vérifiez la garde

Votre bin le plus haut plus la plaque (environ 5 mm) doit rentrer tiroir fermé. Mesurez-le avant de vous lancer sur des bins hauts.

## Erreurs courantes

**Trop de petits bins.** Une grille de bins 1×1 paraît organisée mais agace à l’usage. Des bins plus grands avec séparateurs sont en général meilleurs.

**Remplir chaque case.** Plus de place pour les nouveautés. Prévoyez 10 à 20 % de vide.

**Ignorer ce que vous utilisez vraiment.** N’organisez pas autour de ce que vous croyez devoir posséder. Organisez autour de ce que vous attrapez réellement.

[CTA: Ouvrir l’outil de layout](/)
