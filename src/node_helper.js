const NodeHelper = require("node_helper");
const api = require("./components/api");
const timers = require("./components/timers");
const files = require("./components/files");
const chart = require("./components/chart");
const parser = require("./components/parser");
const rejection = require("./components/rejection");

var log = () => { /* do nothing */ };

module.exports = NodeHelper.create({
  start () {
    this.config = null;
    this.dates = [];
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
    const Tools = {
      sendError: (...args) => {
        this.error = args[1];
        this.sendSocketNotification(...args);
      },
      sendSocketNotification: (...args) => this.sendSocketNotification(...args),
      retryTimer: () => this.tasks.retryTimer(),
      getConsumptionData: () => this.getConsumptionData()
    };

    this.rejection = new rejection(Tools, this.config);
    this.rejection.catchUnhandledRejection();
    this.api = new api(Tools, this.config);
    this.tasks = new timers(Tools, this.config);
    this.files = new files(Tools, this.config);
    this.chart = new chart(Tools, this.config);
    this.parser = new parser(Tools, this.config);

    this.consumptionData = await this.files.readChartData("getDailyConsumption");
    if (Object.keys(this.consumptionData).length) {
      this.sendSocketNotification("DATA", this.consumptionData);
    }
    else {
      this.getConsumptionData("getDailyConsumption");
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
  async getConsumptionData (type) {
    this.Dates = this.chart.calculateDates();
    if (this.Dates === null) return;
    log("Dates demandé:", this.Dates);

    var data = {};
    var error = 0;

    await this.api.request(type, this.Dates).then((result) => {
      if (result.start && result.end && result.interval_reading) {
        log(`[${type}] Données reçues de l'API:`, result);
        data = this.parser.parseData(result);
      } else {
        error = 1;
        console.error(`[LINKY] [${type}] Format inattendu des données:`, result);
        if (result.error) {
          this.error = `[${type}] ${result.error.error}`;
          this.sendSocketNotification("ERROR", this.error);
        } else {
          this.error = `[${type}] Erreur lors de la collecte de données.`;
          this.sendSocketNotification("ERROR", this.error);
        }
      }
    });

    if (!error) {
      log(`[${type}] Données de consommation collecté:`, data);
      this.error = null;
      this.tasks.clearRetryTimer();
      this.consumptionData = this.chart.setChartValue(data);
      this.sendSocketNotification("DATA", this.consumptionData);
      this.files.saveChartData(type, this.consumptionData);
    } else {
      log(`[${type}] Il y a des Erreurs API...`);
      this.tasks.retryTimer();
    }
  }
});
