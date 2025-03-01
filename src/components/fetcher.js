const chart = require("./chart");
const parser = require("./parser");
const api = require("./api");

var log = () => { /* do nothing */ };

class FETCHER {
  constructor (Tools, config) {
    this.config = config;
    if (this.config.debug) log = (...args) => { console.log("[LINKY] [FETCHER]", ...args); };
    this.sendSocketNotification = (...args) => Tools.sendSocketNotification(...args);
    this.clearRetryTimer = () => Tools.clearRetryTimer();
    this.retryTimer = () => Tools.retryTimer();
    this.saveChartData = (...args) => Tools.saveChartData(...args);
    this.chart = new chart(Tools, this.config);
    this.parser = new parser(Tools, this.config);
    this.api = new api(Tools, this.config);
  }

  async getData (type) {
    const dates = this.chart.calculateDates();
    if (dates === null) return;
    log("Dates:", dates);

    var data = {};
    var error = null;

    await this.api.request(type, dates).then((result) => {
      if (result.start && result.end && result.interval_reading) {
        log(`[${type}] Données reçues de l'API:`, result);
        data = this.parser.parseData(result);
      } else {
        console.error(`[LINKY] [${type}] Format inattendu des données:`, result);
        if (result.error) {
          error = `[${type}] ${result.error.error}`;
          this.sendError("ERROR", error);
        } else {
          error = `[${type}] Erreur lors de la collecte de données.`;
          this.sendError("ERROR", error);
        }
      }
    });

    if (!error) {
      log(`[${type}] Données de consommation collecté:`, data);
      this.clearRetryTimer();
      const chartData = this.chart.setChartValue(data);
      this.saveChartData(type, chartData);
      return chartData;
    } else {
      this.retryTimer();
      return null;
    }
  }
}
module.exports = FETCHER;
