const NodeHelper = require("node_helper");
const api = require("./components/api");
const timers = require("./components/timers");
const files = require("./components/files");
const chart = require("./components/chart");
const parser = require("./components/parser");

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
          console.error("[LINKY] ---------");
          console.error("[LINKY] node_helper Error:", error);
          console.error("[LINKY] ---------");
          console.error("[LINKY] Merci de signaler cette erreur aux développeurs");
          this.sendSocketNotification("ERROR", `[Core Crash] ${error}`);
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
