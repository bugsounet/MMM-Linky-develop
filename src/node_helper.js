const { writeFile, readFile, access, constants } = require("node:fs");
const path = require("node:path");
const cron = require("node-cron");
const { CronExpressionParser } = require("cron-parser");
const dayjs = require("dayjs");
const isBetween = require("dayjs/plugin/isBetween");

dayjs.extend(isBetween);
const NodeHelper = require("node_helper");
const api = require("./components/api");

var log = () => { /* do nothing */ };

module.exports = NodeHelper.create({
  start () {
    this.config = null;
    this.api = null;
    this.dates = [];
    this.timer = null;
    this.consumptionData = {};
    this.cronExpression = "0 0 14 * * *";
    this.error = null;
    this.dataPath = path.resolve(__dirname, "data");
    this.timers = {};
  },

  socketNotificationReceived (notification, payload) {
    switch (notification) {
      case "INIT":
        if (!this.ready) {
          this.config = payload;
          this.ready = true;
          this.consumptionData = {};
          this.initialize();
        } else {
          this.initWithCache();
        }
        break;
    }
  },

  // intialisation de MMM-Linky
  async initialize () {
    console.log(`[LINKY] MMM-Linky Version: ${require("./package.json").version} Revison: ${require("./package.json").rev}`);
    if (this.config.debug) log = (...args) => { console.log("[LINKY]", ...args); };
    this.catchUnhandledRejection();
    const Tools = {
      sendSocketNotification: (...args) => this.sendSocketNotification(...args),
      retryTimer: () => this.retryTimer()
    };
    this.api = new api(Tools, this.config);

    await this.readChartData("consumption");
    if (Object.keys(this.consumptionData).length) {
      this.sendSocketNotification("DATA", this.consumptionData);
    }
    else {
      this.getConsumptionData();
    }
    this.scheduleDataFetch();
  },

  // Utilisation du cache interne lors d'une utilisation du "mode Server"
  initWithCache () {
    console.log(`[LINKY] [Cache] MMM-Linky Version: ${require("./package.json").version} Revison: ${require("./package.json").rev}`);
    if (this.error) this.sendSocketNotification("ERROR", this.error);
    if (Object.keys(this.consumptionData).length) this.sendSocketNotification("DATA", this.consumptionData);
    if (Object.keys(this.timers).length) this.sendTimers();
  },

  // Récupération des données
  async getConsumptionData () {
    this.Dates = this.calculateDates();
    if (this.Dates === null) return;
    log("Dates:", this.Dates);

    this.consumptionData = {};
    var error = 0;

    await this.api.request("getDailyConsumption", this.Dates).then((result) => {
      if (result.start && result.end && result.interval_reading) {
        log("Données reçues de l'API :", result);

        result.interval_reading.forEach((reading) => {
          const year = dayjs(reading.date).get("year");
          const day = dayjs(reading.date).get("date");
          const month = dayjs(reading.date).get("month") + 1;
          const value = parseFloat(reading.value);

          if (!this.consumptionData[year]) this.consumptionData[year] = [];

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
              this.consumptionData[year].push({ day, month, value });
            }
          } else {
            this.consumptionData[year].push({ day, month, value });
          }
        });
      } else {
        error = 1;
        console.error("[LINKY] Format inattendu des données :", result);
        if (result.error) {
          this.error = result.error.error;
          this.sendSocketNotification("ERROR", this.error);
        } else {
          this.error = "Erreur lors de la collecte de données.";
          this.sendSocketNotification("ERROR", this.error);
        }
      }
    });

    if (!error) {
      log("Données de consommation collecté:", this.consumptionData);
      this.error = null;
      this.clearRetryTimer();
      this.setChartValue();
    } else {
      log("Il y a des Erreurs API...");
      this.retryTimer();
    }
  },

  // création des données chartjs
  setChartValue () {
    const days = [];
    const datasets = [];
    const colors = this.getChartColors();

    let index = 0;
    for (const year in this.consumptionData) {
      const data = this.consumptionData[year].sort((a, b) => {
        if (a.month === b.month) {
          return a.day - b.day;
        }
        return a.month - b.month;
      });

      const values = data.map((item) => item.value);

      if (index === 0) {
        days.push(
          ...data.map(
            (item) => `${item.day} ${["Error", "janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."][item.month]}`
          )
        );
      }

      datasets.push({
        label: year,
        data: values,
        backgroundColor: colors[index],
        borderColor: colors[index].replace("0.8", "1"),
        borderWidth: 1
      });
      index++;
    }

    log("Données des graphiques :", { labels: days, data: datasets });
    this.consumptionData = {
      labels: days,
      datasets: datasets,
      energie: this.config.annee_n_minus_1 === 1 ? this.setEnergie() : null,
      update: `Données du ${dayjs().format("DD/MM/YYYY -- HH:mm:ss")}`,
      seed: dayjs().valueOf()
    };
    this.sendSocketNotification("DATA", this.consumptionData);
    this.saveChartData("consumption");
  },

  // Selection schémas de couleurs
  getChartColors () {
    const colorSchemes = {
      1: ["rgba(245, 234, 39, 0.8)", "rgba(245, 39, 230, 0.8)"],
      2: ["rgba(252, 255, 0, 0.8)", "rgba(13, 255, 0, 0.8)"],
      3: ["rgba(255, 255, 255, 0.8)", "rgba(0, 255, 242, 0.8)"],
      4: ["rgba(255, 125, 0, 0.8)", "rgba(220, 0, 255, 0.8)"]
    };
    return colorSchemes[this.config.couleur] || colorSchemes[1];
  },

  // cacul des dates périodique
  calculateDates () {
    const endDate = dayjs().format("YYYY-MM-DD");
    var start = dayjs();
    if (this.config.annee_n_minus_1 === 1) start = start.subtract(1, "year");

    switch (this.config.periode) {
      case 1:
        start = start.subtract(1, "day");
        break;
      case 2:
        start = start.subtract(3, "day");
        break;
      case 3:
        start = start.subtract(7, "day");
        break;
      default:
        console.error("[LINKY] periode invalide.");
        this.sendSocketNotification("ERROR", "periode invalide.");
        return null;
    }

    const startDate = dayjs(start).format("YYYY-MM-DD");

    return { startDate, endDate };
  },

  // Création du message Energie
  setEnergie () {
    const currentYearTotal = this.calculateTotalConsumption(dayjs().get("year"));
    const previousYearTotal = this.calculateTotalConsumption(dayjs().subtract(1, "year").get("year"));

    var message, color, periodText;

    switch (this.config.periode) {
      case 1:
        periodText = "le dernier jour";
        break;
      case 2:
        periodText = "les 3 derniers jours";
        break;
      case 3:
        periodText = "les 7 derniers jours";
        break;
      default:
        periodText = "période inconnue";
    }

    if (currentYearTotal < previousYearTotal) {
      message = `Félicitations, votre consommation d'énergie a baissé sur ${periodText} par rapport à l'année dernière !`;
      color = "green";
    } else if (currentYearTotal > previousYearTotal) {
      message = `Attention, votre consommation d'énergie a augmenté sur ${periodText} par rapport à l'année dernière !`;
      color = "red";
    } else {
      message = `Votre consommation d'énergie est stable sur ${periodText} par rapport à l'année dernière.`;
      color = "yellow";
    }

    return {
      message: message,
      color: color
    };
  },

  // Calcul de la comsommation totale
  calculateTotalConsumption (year) {
    let total = 0;
    if (this.consumptionData[year]) {
      this.consumptionData[year].forEach((data) => {
        total += data.value;
      });
    }
    return total;
  },

  // -----------
  // ERROR------
  // -----------

  catchUnhandledRejection () {
    process.on("unhandledRejection", (error) => {
      // catch conso API error and Enedis only
      if (error.stack.includes("MMM-Linky/node_modules/linky/") && error.response) {
        // catch Enedis error
        if (error.response.status && error.response.message && error.response.error) {
          console.error(`[LINKY] [${error.response.status}] ${error.response.message}`);
          this.error = error.response.message;
          this.sendSocketNotification("ERROR", this.error);
        }
        this.retryTimer();
      } else {
        // detect any errors of node_helper of MMM-Linky
        if (error.stack.includes("MMM-Linky/node_helper.js")) {
          console.error(`[LINKY] ${this._citation()}`);
          console.error("[LINKY] Merci de signaler cette erreur aux développeurs");
          console.error("[LINKY] ---------");
          console.error("[LINKY] node_helper Error:", error);
          console.error("[LINKY] ---------");
        } else {
          // from other modules (must never happen... but...)
          console.error("-Other-", error);
        }
      }
    });
  },

  _citation () {
    let citations = [
      "J'ai glissé, chef !",
      "Mirabelle appelle Églantine...",
      "Mais tremblez pas comme ça, ça fait de la mousse !!!",
      "C'est dur d'être chef, Chef ?",
      "Un lapin, chef !",
      "Fou afez trop chaud ou fou afez trop froid ? ",
      "Restez groupire!",
      "On fait pas faire des mouvements respiratoires à un type qu'a les bras cassés !!!",
      "Si j’connaissais l’con qui a fait sauter l’pont...",
      "Le fil rouge sur le bouton rouge, le fil bleu sur le bouton bleu."
    ];
    const random = Math.floor(Math.random() * citations.length);
    return citations[random];
  },

  // -----------
  // TIMER------
  // -----------

  // Retry Timer en cas d'erreur, relance la requete 2 heures apres
  retryTimer () {
    if (this.timer) this.clearRetryTimer();
    this.timer = setTimeout(() => {
      log("Retry-Timer: Démarrage");
      this.getConsumptionData();
    }, 1000 * 60 * 60 * 2);
    let job = dayjs(dayjs() + this.timer._idleNext.expiry);
    log("Retry-Timer planifié:", job.format("[Le] DD/MM/YYYY -- HH:mm:ss"));
    this.sendTimer(job.valueOf(), job.format("[Le] DD/MM/YYYY -- HH:mm:ss"), "RETRY");
  },

  // Retry Timer kill
  clearRetryTimer () {
    if (this.timer) log("Retry-Timer: Arrêt");
    clearTimeout(this.timer);
    this.timer = null;
    this.sendTimer(null, null, "RETRY");
  },

  // Récupération planifié des données
  scheduleDataFetch () {
    const randomMinute = Math.floor(Math.random() * 59);
    const randomSecond = Math.floor(Math.random() * 59);

    this.cronExpression = `${randomSecond} ${randomMinute} 14 * * *`;
    cron.schedule(this.cronExpression, () => {
      log("Exécution de la tâche planifiée de récupération des données.");
      this.getConsumptionData();
      this.displayNextCron();
    });
    this.displayNextCron();
  },

  // Affiche la prochaine tache Cron
  displayNextCron () {
    const next = CronExpressionParser.parse(this.cronExpression, { tz: "Europe/Paris" });
    let nextCron = dayjs(next.next().toString());
    log("Prochaine tâche planifiée:", nextCron.format("[Le] DD/MM/YYYY -- HH:mm:ss"));
    this.sendTimer(nextCron.valueOf(), nextCron.format("[Le] DD/MM/YYYY -- HH:mm:ss"), "CRON");
  },

  // Envoi l'affichage de la date du prochain update
  sendTimer (seed, date, type) {
    let timer = {
      seed: seed,
      date: date,
      type: type
    };
    this.timers[type] = timer;
    this.sendSocketNotification("TIMERS", timer);
  },

  // envoi l'affichage de tous les timers (server mode)
  sendTimers () {
    const timers = Object.values(this.timers);
    timers.forEach((timer) => {
      this.sendSocketNotification("TIMERS", timer);
    });
  },

  // -----------
  // CACHE FILES
  // -----------

  // Exporte les donnée Charts
  saveChartData (type) {
    var file, data;
    switch (type) {
      case "consumption":
        file = `${this.dataPath}/consumption.json`;
        data = this.consumptionData;
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
  },

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
          switch (type) {
            case "consumption":
              this.consumptionData = {};
              break;
          }
          resolve();
          return;
        }

        // lit le fichier
        readFile(file, (err, data) => {
          if (err) {
            console.error(`[LINKY] [${type}] Erreur de la lecture du fichier cache!`, err);
            this.consumptionData = {};
            resolve();
            return;
          }
          const linkyData = JSON.parse(data);
          const now = dayjs().valueOf();
          const seed = dayjs(linkyData.seed).format("DD/MM/YYYY -- HH:mm:ss");
          const next = dayjs(linkyData.seed).add(12, "hour").valueOf();
          if (now > next) {
            log(`[${type}] Les dernieres données reçues sont > 12h, utilisation de l'API...`);
            switch (type) {
              case "consumption":
                this.consumptionData = {};
                break;
            }
          } else {
            log(`[${type}] Utilisation du cache:`, seed);
            switch (type) {
              case "consumption":
                this.consumptionData = linkyData;
                break;
            }
          }
          resolve();
        });
      });
    });
  }
});
