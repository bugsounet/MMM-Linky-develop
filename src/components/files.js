const { writeFile, readFile, access, constants } = require("node:fs");
const path = require("node:path");
const dayjs = require("dayjs");

var log = () => { /* do nothing */ };

class FILES {
  constructor (Tools, config) {
    this.config = config;
    if (this.config.debug) log = (...args) => { console.log("[LINKY] [FILES]", ...args); };
    this.dataPath = path.resolve(__dirname, "../data");
  }

  // Exporte les donnée Charts
  saveData (type, data) {
    if (!type) {
      console.error("[LINKY] [FILES] Type de Données inconnue");
      return;
    }

    const file = `${this.dataPath}/${type}.json`;

    if (!data) {
      console.error(`[LINKY] [FILES] Aucune données à sauvegarder pour ${type}`);
      return;
    }

    const jsonData = JSON.stringify(data, null, 2);
    writeFile(file, jsonData, "utf8", (err) => {
      if (err) {
        console.error(`[LINKY] [FILES] [${type}] Erreur lors de l'exportation des données`, err);
      } else {
        log(`[${type}] Les données ont été exporté vers`, file);
      }
    });
  }

  // Lecture des fichiers de données Charts
  readData (type) {
    if (!type) {
      console.error("[LINKY] [FILES] Type de Données inconnue");
      return;
    }

    const file = `${this.dataPath}/${type}.json`;

    return new Promise((resolve) => {
      // verifie la presence
      access(file, constants.F_OK, (error) => {
        if (error) {
          log(`[${type}] Pas de fichier cache trouvé`);
          resolve();
          return;
        }

        // lit le fichier
        readFile(file, (err, data) => {
          if (err) {
            console.error(`[LINKY] [FILES] [${type}] Erreur de la lecture du fichier cache!`, err);
            resolve();
            return;
          }
          const linkyData = JSON.parse(data);

          if (linkyData.type !== type) {
            console.error(`[LINKY] [FILES] [${type}] Fichier cache invalide!`);
            resolve();
            return;
          }

          if (!linkyData.seed) {
            console.error(`[LINKY] [FILES] [${type}] Cache invalide!`);
            resolve();
            return;
          }

          if (!linkyData.ignoreAnnee_n_minus_1 && (linkyData.annee_n_minus_1 !== this.config.annee_n_minus_1)) {
            console.log(`[LINKY] [FILES] [${type}] La configuration annee_n_minus_1 a changé.`);
            resolve();
            return;
          }

          if (!linkyData.ignorePeriode && (linkyData.periode !== this.config.periode)) {
            console.log(`[LINKY] [FILES] [${type}] La configuration periode a changé.`);
            resolve();
            return;
          }

          const now = dayjs().valueOf();
          const seed = dayjs(linkyData.seed).format("DD/MM/YYYY -- HH:mm:ss");
          const next = dayjs(linkyData.seed).add(12, "hour").valueOf();
          if (now > next) {
            console.log(`[LINKY] [FILES] [${type}] Les dernières données reçues sont > 12h, utilisation de l'API...`);
            resolve();
          } else {
            console.log(`[LINKY] [FILES] [${type}] Utilisation du cache ${seed}`);
            resolve(linkyData);
          }
        });
      });
    });
  }
}
module.exports = FILES;
