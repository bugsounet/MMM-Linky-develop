const dayjs = require("dayjs");
const chart = require("./chart");
const parser = require("./parser");
const api = require("./api");
const files = require("./files");

var log = () => { /* do nothing */ };

class FETCHER {
  constructor (Tools, config) {
    this.config = config;
    if (this.config.debug) log = (...args) => { console.log("[LINKY] [FETCHER]", ...args); };
    this.sendError = (error) => Tools.sendError(error);
    this.retryTimer = () => Tools.retryTimer();
    this.chart = new chart(Tools, this.config);
    this.parser = new parser(Tools, this.config);
    this.api = new api(Tools, this.config);
    this.files = new files(Tools, this.config);
    this.call = this.config.apis;
  }

  async refresh () {
    var datas = {};

    for (const call of this.call) {
      log("[Refresh] Chargement:", call);
      datas[call] = await this.getData(call);
      log("[Refresh] Termimé:", call);
    }
    return datas;
  }

  async loadCache () {
    var datas = {};

    for (const call of this.call) {
      log("[Cache] Chargement:", call);
      const result = await this.files.readData(call);
      if (!result) datas[call] = await this.getData(call);
      else {
        const parsedData = this.parser.parseData(call, result);
        datas[call] = await this.chart.setChartValue(call, parsedData);
        log("[Cache] Terminé:", call);
      }
    }
    return datas;
  }

  async getData (type) {
    const dates = this.chart.calculateDates(type);
    if (dates === null) return;
    log("Dates:", dates);

    var parsedData = {};
    var error = null;

    const isIgnorePeriode = () => {
      if (type === "getLoadCurve") return true;
      if (type === "getProductionLoadCurve") return true;
      return false;
    };

    const isIgnoreAnnee_n_minus_1 = () => {
      if (type === "getLoadCurve") return true;
      if (type === "getMaxPower") return true;
      if (type === "getProductionLoadCurve") return true;
      return false;
    };

    await this.api.request(type, dates)
      .then((result) => {
        if (result.error) {
          error = true;
        } else {
          if (result.start && result.end && result.interval_reading) {
            result.annee_n_minus_1 = this.config.annee_n_minus_1;
            result.ignoreAnnee_n_minus_1 = isIgnoreAnnee_n_minus_1();
            result.periode = this.config.periode;
            result.ignorePeriode = isIgnorePeriode();
            result.seed = dayjs().valueOf();
            result.type = type;
            log(`[${type}] Données reçues de l'API:`, result);
            this.files.saveData(type, result);
            parsedData = this.parser.parseData(type, result);
          } else {
            console.error(`[LINKY] [${type}] Format inattendu des données:`, result);
            if (result.error) {
              error = `[${type}] ${result.error.error}`;
            } else {
              error = `[${type}] Erreur lors de la collecte de données.`;
            }
            this.sendError(error);
          }
        }
      });

    if (!error) {
      log(`[${type}] Données collectées:`, parsedData);
      const chartData = this.chart.setChartValue(type, parsedData);
      return chartData;
    } else {
      this.retryTimer();
      return null;
    }
  }
}
module.exports = FETCHER;
