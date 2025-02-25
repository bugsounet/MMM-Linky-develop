const { writeFile, readFile, access, constants } = require("node:fs");
const path = require("node:path");
const cron = require("node-cron");
const { CronExpressionParser } = require("cron-parser");
const dayjs = require("dayjs");
const NodeHelper = require("node_helper");

var log = () => { /* do nothing */ };

module.exports = NodeHelper.create({
  start () {
    this.Linky = null;
    this.config = null;
    this.dates = [];
    this.timer = null;
    this.consumptionData = {};
    this.cronExpression = "0 0 14 * * *";
    this.error = null;
    this.dataFile = path.resolve(__dirname, "linkyData.json");
    this.timers = {};
  },

  socketNotificationReceived (notification, payload) {
    switch (notification) {
      case "INIT":
        if (!this.ready) {
          this.config = payload;
          this.ready = true;
          this.chartData = {};
          this.initialize();
        } else {
          this.initWithCache();
        }
        break;
    }
  },

  // intialisation de MMM-Linky
  async initialize () {
    this.catchError();
    console.log(`[LINKY] MMM-Linky Version: ${require("./package.json").version} Revison: ${require("./package.json").rev}`);
    if (this.config.debug) log = (...args) => { console.log("[LINKY]", ...args); };
    log("Config:", this.config);
    this.Dates = this.calculateDates();
    if (!Object.keys(this.Dates).length) return;
    log("Dates:", this.Dates);

    await this.readChartData();
    if (Object.keys(this.chartData).length) {
      this.sendSocketNotification("DATA", this.chartData);
    }
    else {
      this.getConsumptionData();
    }
    this.scheduleDataFetch();
  },

  // Initialisation de l'api linky
  async initLinky (callback) {
    const { Session } = await this.loadLinky();
    try {
      this.Linky = new Session(this.config.token, this.config.prm);
      log("API linky Prête");
      if (callback) callback();
    } catch (error) {
      console.error(`[LINKY] ${error}`);
      this.error = error.message;
      this.sendSocketNotification("ERROR", this.error);
    }
  },

  // Utilisation du cache interne lors d'une utilisation du "mode Server"
  initWithCache () {
    console.log(`[LINKY] [Cache] MMM-Linky Version: ${require("./package.json").version} Revison: ${require("./package.json").rev}`);
    if (this.error) this.sendSocketNotification("ERROR", this.error);
    if (Object.keys(this.chartData).length) this.sendSocketNotification("DATA", this.chartData);
    if (Object.keys(this.timers).length) this.sendTimers();
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

  // Récupération des données
  async getConsumptionData () {
    if (!this.Linky) {
      this.initLinky(() => this.getConsumptionData());
      return;
    }
    this.consumptionData = {};
    var error = 0;

    await this.sendConsumptionRequest(this.Dates).then((result) => {
      if (result.start && result.end && result.interval_reading) {
        log("Données reçues de l'API :", result);

        result.interval_reading.forEach((reading) => {
          const year = dayjs(reading.date).get("year");
          const day = dayjs(reading.date).get("date");
          const month = dayjs(reading.date).get("month") + 1;
          const value = parseFloat(reading.value);

          if (!this.consumptionData[year]) this.consumptionData[year] = [];

          if (this.config.annee_n_minus_1 === 1) {
            const current = dayjs();
            const currentYear = current.year();
            var testDate = current.subtract(1, "day");
            if (currentYear === year) {
              // année en cours
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
              if (dayjs(testDate).isBefore(dayjs(reading.date))) {
                this.consumptionData[year].push({ day, month, value });
              }
            } else {
              // année precedente
              testDate = testDate.subtract(1, "year");
              if (dayjs(reading.date).isBefore(dayjs(testDate))) {
                this.consumptionData[year].push({ day, month, value });
              }
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
    this.chartData = {
      labels: days,
      datasets: datasets,
      energie: this.config.annee_n_minus_1 === 1 ? this.setEnergie() : null,
      update: `Données du ${dayjs().format("DD/MM/YYYY -- HH:mm:ss")}`,
      seed: dayjs().valueOf()
    };
    this.sendSocketNotification("DATA", this.chartData);
    this.saveChartData();
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

  // Demande des datas selon l'API
  sendConsumptionRequest (date) {
    return new Promise((resolve) => {
      this.Linky.getDailyConsumption(date.startDate, date.endDate).then((result) => {
        resolve(result);
      });
    });
  },

  // Importation de la librairie linky (dynamic impor)
  async loadLinky () {
    const loaded = await import("linky");
    return loaded;
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

  // Affiche la prochaine tache Cron
  displayNextCron () {
    const next = CronExpressionParser.parse(this.cronExpression, { tz: "Europe/Paris" });
    let nextCron = dayjs(next.next().toString());
    log("Prochaine tâche planifiée:", nextCron.format("[Le] DD/MM/YYYY -- HH:mm:ss"));
    this.sendTimer(nextCron.valueOf(), nextCron.format("[Le] DD/MM/YYYY -- HH:mm:ss"), "CRON");
  },

  // Exporte les donnée Charts vers linkyData.json
  saveChartData () {
    const jsonData = JSON.stringify(this.chartData, null, 2);
    writeFile(this.dataFile, jsonData, "utf8", (err) => {
      if (err) {
        console.error("Erreur lors de l'exportation des données", err);
      } else {
        log("Les données ont été exporté vers", this.dataFile);
      }
    });
  },

  // Lecture du fichier linkyData.json
  readChartData () {
    return new Promise((resolve) => {
      // verifie la presence
      access(this.dataFile, constants.F_OK, (error) => {
        if (error) {
          log("Pas de fichier cache trouvé");
          this.chartData = {};
          resolve();
          return;
        }

        // lit le fichier
        readFile(this.dataFile, (err, data) => {
          if (err) {
            console.error("[LINKY] Erreur de la lecture du fichier cache!", err);
            this.chartData = {};
            resolve();
            return;
          }
          const linkyData = JSON.parse(data);
          const now = dayjs().valueOf();
          const seed = dayjs(linkyData.seed).format("DD/MM/YYYY -- HH:mm:ss");
          const next = dayjs(linkyData.seed).add(12, "hour").valueOf();
          if (now > next) {
            log("Les dernieres données reçues sont > 12h, utilisation de l'API...");
            this.chartData = {};
          } else {
            log("Utilisation du cache:", seed);
            this.chartData = linkyData;
          }
          resolve();
        });
      });
    });
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

  catchError () {
    process.on("unhandledRejection", (error) => {
      // catch conso API error and Enedis only
      if (error.stack.includes("MMM-Linky/node_modules/linky/") && error.response) {
        // catch Enedis error
        if (error.response.status && error.response.message && error.response.error) {
          console.error(`[LINKY] [${error.response.status}] ${error.response.message}`);
          this.error = error.response.message;
          this.sendSocketNotification("ERROR", this.error);
        } else {
          // catch Conso API error
          if (error.message) {
            console.error(`[LINKY] [${error.code}] ${error.message}`);
            this.error = `[${error.code}] ${error.message}`;
            this.sendSocketNotification("ERROR", this.error);
          } else {
            // must never Happen...
            console.error("[LINKY]", error);
          }
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
  }
});
