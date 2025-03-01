const dayjs = require("dayjs");
const isBetween = require("dayjs/plugin/isBetween");

dayjs.extend(isBetween);

var log = () => { /* do nothing */ };

class PARSER {
  constructor (Tools, config) {
    this.config = config;
    if (this.config.debug) log = (...args) => { console.log("[LINKY] [PARSER]", ...args); };
    this.sendSocketNotification = (...args) => Tools.sendSocketNotification(...args);
  }

  parseData (result) {
    log("Démarrage...");
    var data = {};
    var added = 0;

    result.interval_reading.forEach((reading) => {
      const year = dayjs(reading.date).get("year");
      const value = parseFloat(reading.value);

      if (!data[year]) data[year] = [];

      if (this.config.annee_n_minus_1 === 1) {
        var current = dayjs().set("hour", 0).set("minute", 0).set("second", 0);
        const currentYear = current.year();
        var testDate = current.subtract(1, "day");
        switch (this.config.periode) {
          case 1:
            testDate = testDate.subtract(1, "day");
            break;
          case 2:
            testDate = testDate.subtract(3, "day");
            break;
          case 3:
            testDate = testDate.subtract(7, "day");
            break;
          default:
            testDate = current;
            break;
        }
        if (currentYear !== year) {
          testDate = testDate.subtract(1, "year");
          current = current.subtract(1, "day").subtract(1, "year");
        }
        if (dayjs(reading.date).isBetween(testDate, current)) {
          log(`Ajoute pour ${year}:`, { date: reading.date, value });
          data[year].push({ date: reading.date, value });
          added++;
        }
      } else {
        log(`Ajoute pour ${year}:`, { date: reading.date, value });
        data[year].push({ date: reading.date, value });
        added++;
      }
    });
    log(`Terminé: ${added} dates trouvées.`);
    return data;
  }
}
module.exports = PARSER;
