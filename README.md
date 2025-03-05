# MMM-Linky

Ce module a été spécialement conçu pour les utilisateurs français possédant un compteur Linky.

Grâce à une intégration fluide avec Conso API, il permet de récupérer et d'afficher les données de consommation d'énergie directement sur votre miroir.

Si vous choisissez de récupérer les données de l'année précédente une comparaison sera effectuée et un message vous indiquant si vous avec + ou - consommé sera affiché.

Le header est également dynamique et changera en fonction de la période sélectionnée !

Les données sont actualisées chaque jour entre 14h et 15h.

## ScreenShots

![Conso 7 derniers jours](https://github.com/user-attachments/assets/055eef27-43bb-478c-a2cb-16a451bac5b4)
![Conso 3 derniers jours](https://github.com/user-attachments/assets/6dacfd38-d78e-4cb3-be22-be8aec980729)
![Conso veille](https://github.com/user-attachments/assets/6e965953-0c5d-466e-accd-40d09ae3ab71)

Possibilité de choisir entre 4 thèmes de couleur pour le graphique et d'afficher les valeurs dans les barres :

![WithDataLabel](https://github.com/user-attachments/assets/a4196ed6-2289-487d-a4dc-aee6fb35ff06)
![Capture](https://github.com/user-attachments/assets/52c76634-4543-41e0-be96-27326745fa3d)

## Installation

```sh
cd ~/MagicMirror/modules
git clone https://github.com/2hdlockness/MMM-Linky
cd MMM-Linky
npm run setup
```

## Using the module

### Pré-requis

* Obtenir un token personnel depuis le site <https://conso.boris.sh/>
* Récupérer son numéro PDL Linky (PRM). Vous ne savez pas où le trouver cliquez [ICI](https://www.enedis.fr/faq/compteur-linky/ou-trouver-le-numero-point-de-livraison-pdl-du-compteur-linky)

Pour utiliser ce module, ajoutez-le au tableau modules dans le fichier `config/config.js` :

```js
    {
      module: "MMM-Linky",
      position: "top_left",
      config: {
        debug: 0,
        prm: "",
        token: "",
        periode: 1,
        annee_n_minus_1: 1,
        couleur: 3,
        valuebar: 1,
        valuebartextcolor: 0,
        header: 1,
        energie: 1,
        updateDate: 1,
        updateNext: 1
      },
    },
```

Configuration minimale :

```js
    {
      module: "MMM-Linky",
      position: "top_left",
      config: {
        prm: "",
        token: "",
        apis: ["getDailyConsumption"]
      },
    },
```

## Configuration options

Option|Default|Description
---|---|---
`debug`|0|Active le mode débogage. <br>`1` : activer <br> `0` : Désactiver
`prm`||Votre numéro PDL Linky [VOIR ICI](https://www.enedis.fr/faq/compteur-linky/ou-trouver-le-numero-point-de-livraison-pdl-du-compteur-linky)
`token`||Votre token personnel [CONSO API](https://conso.boris.sh/)
`periode`|1|Choix de la période: <br>`1` = Données de la veille <br>`2` = 3 derniers jours <br>`3` = 7 derniers jours
`apis`|["getDailyConsumption"]|Nom des API à interroger (voir ci-dessous)
`affichageInterval`|1000 * 15|Interval d'affichage des graphiques en ms (si utilisation de plusieurs API)
`annee_n_minus_1`|1|Récupérer les données de l'année précédente. (uniquement pour les api `getDailyConsumption` et `getDailyProduction`) <br>`1` : Activer <br> `0` : Désactiver
`couleur`|3| `1` : Bleu et Rose <br>`2` : Jaune et Vert <br>`3` : Blanc et Bleu <br>`4` : Orange et Violet
`valuebar`|1|Affiche les valeurs à l'intérieur des barres. <br>`1` : Afficher <br>`0` : Masquer
`valuebartextcolor`|0|Couleur du texte des valeurs. <br>`0` : Texte noir <br>`1` : Texte blanc
`header`|1|Affiche l'en-tête selon la période selectionné. <br>`1` : Afficher <br>`0` : Masquer
`energie`|1|Affiche l'indicateur de consomation d'énergie. <br>`1` : Afficher <br>`0` : Masquer
`updateDate`|1|Affiche la date de récupération des données. <br>`1` : Afficher <br>`0` : Masquer
`updateNext`|1|Affiche la date du prochain cycle de récupération des données. <br>`1` : Afficher <br>`0` : Masquer

### apis

Grâce à `Conso API`, vous pouvez interroger plusieurs api et afficher le graphique correspondant.

* `getDailyConsumption`: Récupère la consommation quotidienne.
* `getLoadCurve`: Récupère la puissance moyenne consommée de la veille sur un intervalle de 30 min.
* `getMaxPower`: Récupère la puissance maximale de consommation atteinte quotidiennement.

Il est également possible d'afficher vos données de production d'energie.

* `getDailyProduction`: Récupère la production quotidienne.
* `getProductionLoadCurve`: Récupère la puissance moyenne produite sur un intervalle de 30 min.

## Mise en cache des données

Afin d'éviter une surcharge de l'api, une mise en cache des données a été mise en place.

De ce fait, lors d'un redémarrage de `MagicMirror²`, `MMM-Linky` utilisera les dernières données converties pour l'affichage graphique.

La validité de ce cache à été fixé a 10h.

## Effacer le cache des données

Vous pouvez toute fois détruire ce cache avec la commande: `npm run reset:cache`

Il est déconseillé d'utiliser cette commande trop souvent car l'api a un usage limité.

`Conso API` a fixé cette régle:

* Maximum de 5 requêtes par seconde.
* Maximum de 10 000 requêtes par heure.

⚠ Si vous dépasser une des régles, votre adresse IP se retrouvera bloqué sans avertissement !

Malheurement, nous avons aucun pouvoir pour la débloquer...

Pour rappel un appel API c'est une requête. si vous utilisez 2 API en config... c'est donc 2 requêtes !

## Mise à jour

```sh
cd ~/MagicMirror/modules/MMM-Linky
npm run update
```

## Faire un don

Si vous aimez ce module et que vous êtes généreux !

[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://www.paypal.com/donate?hosted_button_id=DQW6PLJLDDB8L)

Merci !

## Crédits

* Auteurs :
  * @2hdlockness
  * @bugsounet
* License : MIT
