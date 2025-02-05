# MMM-Linky

Ce module a été spécialement conçu pour les utilisateurs français possédant un compteur Linky.

Grâce à une intégration fluide avec Conso API, il permet de récupérer et d'afficher les données de consommation d'énergie directement sur votre miroir.

Si vous choisissez de récupérer les données de l'année précédente une comparaison sera effectuée et un message vous indiquant si vous avec + ou - consommé sera affiché.

Le header est également dynamique et changera en fonction de la période sélectionnée !

Les données sont actualisées chaque jour entre 10h et 13h.

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
npm install
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
        prm: "",
        token: "",
        periode: 1,
        annee_n_minus_1: 1,
        couleur: 3,
        valuebar: 1,
        valuebartextcolor: 0
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
      },
    },
```

## Configuration options

Option|Default|Description
---|---|---
`prm`||Votre numéro PDL Linky [VOIR ICI](https://www.enedis.fr/faq/compteur-linky/ou-trouver-le-numero-point-de-livraison-pdl-du-compteur-linky)
`token`||Votre token personnel  [CONSO API](https://conso.boris.sh/)
`periode`|1|Choix de la période: <br>`1` = Données de la veille <br>`2` = 3 derniers jours <br>`3` = 7 derniers jours
`annee_n_minus_1`|1|Récupérer les données de l'année précédente. <br>`1` : activer <br> `0` : désactiver
`couleur`|3| `1` : Bleu et Rose <br>`2` : Jaune et Vert <br>`3` : Blanc et Bleu <br>`4` : Orange et Violet
`valuebar`|1|Affiche les valeurs à l'intérieur des barres. <br>`1` : afficher <br>`0` : masquer
`valuebartextcolor`|0|Couleur du texte des valeurs. <br>`0` : texte noir <br>`1` : texte blanc

## Mise à jour

```sh
cd ~/MagicMirror/modules/MMM-Linky
git reset --hard HEAD && git pull
npm install
```

## Faire un don

Si vous aimez ce module et que vous êtes généreux !

[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://www.paypal.com/donate?hosted_button_id=DQW6PLJLDDB8L)

Merci !

## Crédits

* Auteur : @2hdlockness
* License : MIT
