const { writeFile, readFile, access, constants } = require("node:fs");
const path = require("node:path");
const dayjs = require("dayjs");

var log = () => { /* do nothing */ };

class FILES {
  constructor (Tools, config) {
    this.config = config;
    if (this.config.debug) log = (...args) => { console.log("[LINKY] [FILES]", ...args); };
    this.dataPath = path.resolve(__dirname, "../data");
    this.sendSocketNotification = (...args) => Tools.sendSocketNotification(...args);
  }

  // Exporte les donnée Charts
  saveChartData (type, data) {
    var file;
    switch (type) {
      case "consumption":
        file = `${this.dataPath}/consumption.json`;
        break;
    }

    const jsonData = JSON.stringify(data, null, 2);
    writeFile(file, jsonData, "utf8", (err) => {
      if (err) {
        console.error(`[${type}] Erreur lors de l'exportation des données`, err);
      } else {
        log(`[${type}] Les données ont été exporté vers`, file);
      }
    });
  }

  // Lecture des fichiers de données Charts
  readChartData (type) {
    var file;
    switch (type) {
      case "consumption":
        file = `${this.dataPath}/consumption.json`;
        break;
    }
    return new Promise((resolve) => {
      // verifie la presence
      access(file, constants.F_OK, (error) => {
        if (error) {
          log(`[${type}] Pas de fichier cache trouvé`);
          resolve({});
          return;
        }

        // lit le fichier
        readFile(file, (err, data) => {
          if (err) {
            console.error(`[LINKY] [${type}] Erreur de la lecture du fichier cache!`, err);
            resolve({});
            return;
          }
          const linkyData = JSON.parse(data);
          const now = dayjs().valueOf();
          const seed = dayjs(linkyData.seed).format("DD/MM/YYYY -- HH:mm:ss");
          const next = dayjs(linkyData.seed).add(12, "hour").valueOf();
          if (now > next) {
            log(`[${type}] Les dernieres données reçues sont > 12h, utilisation de l'API...`);
            resolve({});
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
