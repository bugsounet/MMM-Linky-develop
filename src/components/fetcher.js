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
      datas[call] = await this.files.readChartData(call);
      if (!datas[call]) datas[call] = await this.getData(call);
      log("[Cache] Terminé:", call);
    }
    return datas;
  }

  async getData (type) {
    const dates = this.chart.calculateDates(type);
    if (dates === null) return;
    log("Dates:", dates);

    var data = {};
    var error = null;

    await this.api.request(type, dates)
      .then((result) => {
        if (result.error) {
          error = true;
        } else {
          if (result.start && result.end && result.interval_reading) {
            log(`[${type}] Données reçues de l'API:`, result);
            data = this.parser.parseData(type, result);
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
      log(`[${type}] Données de consommation collecté:`, data);
      const chartData = this.chart.setChartValue(type, data);
      this.files.saveChartData(type, chartData);
      return chartData;
    } else {
      this.retryTimer();
      return null;
    }
  }
}
module.exports = FETCHER;
