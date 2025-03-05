const NodeHelper = require("node_helper");

const timers = require("./components/timers");
const rejection = require("./components/rejection");
const fetcher = require("./components/fetcher");

module.exports = NodeHelper.create({
  socketNotificationReceived (notification, payload) {
    switch (notification) {
      case "INIT":
        if (!this.ready) {
          this.config = payload;
          this.ready = true;
          this.data = {};
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
    const apis = ["getDailyConsumption", "getLoadCurve", "getMaxPower", "getDailyProduction", "getProductionLoadCurve"];
    const Tools = {
      sendError: (error) => {
        this.error = error;
        this.sendSocketNotification("ERROR", this.error);
      },
      sendSocketNotification: (...args) => this.sendSocketNotification(...args),
      retryTimer: () => this.tasks.retryTimer(),
      saveChartData: (...args) => this.files.saveChartData(...args),
      refreshData: async () => {
        this.tasks.clearRetryTimer();
        this.data = await this.fetcher.refresh();
        this.sendSocketNotification("DATA", this.data);
      }
    };

    this.rejection = new rejection(Tools, this.config);
    this.rejection.catchUnhandledRejection();

    if (!Array.isArray(this.config.apis)) {
      this.error = "[config] Les APIs doivent être inscrite dans le tableau apis:[]";
      this.sendSocketNotification("ERROR", this.error);
      return;
    }

    if (!this.config.apis.length) {
      this.error = "[config] Veuillez spécifier une API dans apis:[]";
      this.sendSocketNotification("ERROR", this.error);
      return;
    }

    const uniqAPI = [...new Set(this.config.apis)];
    this.config.apis = uniqAPI;

    for (const api of this.config.apis) {
      if (!apis.includes(api)) {
        this.error = `[config.apis] L'api ${api} n'est pas valide.`;
        this.sendSocketNotification("ERROR", this.error);
        return;
      }
    }

    this.sendSocketNotification("CONFIG", this.config.apis);

    this.tasks = new timers(Tools, this.config);
    this.tasks.scheduleDataFetch();

    this.fetcher = new fetcher(Tools, this.config);
    this.data = await this.fetcher.loadCache();

    this.sendSocketNotification("INIT", this.data);
  },

  // Utilisation du cache interne lors d'une utilisation du "mode Server"
  initWithCache () {
    console.log(`[LINKY] [Cache] MMM-Linky Version: ${require("./package.json").version} Revison: ${require("./package.json").rev}`);
    if (this.error) this.sendSocketNotification("ERROR", this.error);
    if (this.data) this.sendSocketNotification("INIT", this.data);
    if (Object.keys(this.tasks.timers).length) this.tasks.sendTimers();
  }
});
