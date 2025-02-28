const dayjs = require("dayjs");
const isBetween = require("dayjs/plugin/isBetween");

dayjs.extend(isBetween);

const NodeHelper = require("node_helper");
const api = require("./components/api");
const timers = require("./components/timers");
const files = require("./components/files");

var log = () => { /* do nothing */ };

module.exports = NodeHelper.create({
  start () {
    this.config = null;
    this.api = null;
    this.task = null;
    this.files = null;
    this.dates = [];
    this.consumptionData = {};
    this.error = null;
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
      sendError: (...args) => {
        this.error = args[1];
        this.sendSocketNotification(...args);
      },
      sendSocketNotification: (...args) => this.sendSocketNotification(...args),
      retryTimer: () => this.tasks.retryTimer(),
      getConsumptionData: () => this.getConsumptionData()
    };

    this.api = new api(Tools, this.config);
    this.tasks = new timers(Tools, this.config);
    this.files = new files(Tools, this.config);

    this.consumptionData = await this.files.readChartData("consumption");
    if (Object.keys(this.consumptionData).length) {
      this.sendSocketNotification("DATA", this.consumptionData);
    }
    else {
      this.getConsumptionData();
    }
    this.tasks.scheduleDataFetch();
  },

  // Utilisation du cache interne lors d'une utilisation du "mode Server"
  initWithCache () {
    console.log(`[LINKY] [Cache] MMM-Linky Version: ${require("./package.json").version} Revison: ${require("./package.json").rev}`);
    if (this.error) this.sendSocketNotification("ERROR", this.error);
    if (Object.keys(this.consumptionData).length) this.sendSocketNotification("DATA", this.consumptionData);
    if (Object.keys(this.tasks.timers).length) this.tasks.sendTimers();
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
      this.tasks.clearRetryTimer();
      this.setChartValue();
    } else {
      log("Il y a des Erreurs API...");
      this.tasks.retryTimer();
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
    this.files.saveChartData("consumption", this.consumptionData);
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
        this.tasks.retryTimer();
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
