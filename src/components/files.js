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
  saveChartData (type, data) {
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
  readChartData (type) {
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
          const now = dayjs().valueOf();
          const seed = dayjs(linkyData.seed).format("DD/MM/YYYY -- HH:mm:ss");
          const next = dayjs(linkyData.seed).add(12, "hour").valueOf();
          if (now > next) {
            log(`[${type}] Les dernieres données reçues sont > 12h, utilisation de l'API...`);
            resolve();
          } else {
            log(`[${type}] Utilisation du cache:`, seed);
            resolve(linkyData);
          }
        });
      });
    });
  }
}
module.exports = FILES;
