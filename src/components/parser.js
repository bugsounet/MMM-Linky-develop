const dayjs = require("dayjs");
const isBetween = require("dayjs/plugin/isBetween");
const isLeapYear = require("dayjs/plugin/isLeapYear");

dayjs.extend(isBetween);
dayjs.extend(isLeapYear);

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
    var LeapYear = false;

    result.interval_reading.forEach((reading) => {
      const year = dayjs(reading.date).get("year");
      const value = parseFloat(reading.value);

      if (!data[year]) data[year] = [];

      if (this.config.annee_n_minus_1 === 1) {
        var current = dayjs().set("hour", 0).set("minute", 0).set("second", 0);
        const currentIsLeapYear = current.isLeapYear();
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
        const testDateIsLeapYear = testDate.isLeapYear();

        if (dayjs(reading.date).isBetween(testDate, current)) {
          // LeapYear testing
          if (testDateIsLeapYear && dayjs(reading.date).month() === 1 && dayjs(reading.date).date() === 29) {
            log(`Année bissextile: ${year} -> ignore 29/02`);
          } else {
            if (currentIsLeapYear && dayjs(reading.date).month() === 1 && dayjs(reading.date).date() === 29) {
              LeapYear = true;
              log(`Année bissextile pour ${year}:`, { date: `${year - 1}-02-29`, value: 0 });
              if (!data[year - 1]) data[year - 1] = [];
              data[year - 1].push({ date: `${year - 1}-02-29`, value: 0 });
              added++;
            }
            log(`Ajoute pour ${year}:`, { date: reading.date, value });
            data[year].push({ date: reading.date, value });
            added++;
          }
        }
      } else {
        log(`Ajoute pour ${year}:`, { date: reading.date, value });
        data[year].push({ date: reading.date, value });
        added++;
      }
    });
    if (LeapYear) {
      // a voir a la prochaine Année bissextile...
      for (const year in data) {
        log(`Classements des dates pour ${year}...`);
        data[year].sort((a, b) => {
          if (a.date < b.date) {
            return -1;
          }
          if (a.date > b.date) {
            return 1;
          }
          return 0;
        });
        log(`Suppression des premières données pour ${year}:`, data[year][0]);
        data[year].shift();
        added--;
      }
    }
    log(`Terminé: ${added} dates trouvées.`);
    return data;
  }
}
module.exports = PARSER;
