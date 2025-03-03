const NodeHelper = require("node_helper");

const timers = require("./components/timers");
const rejection = require("./components/rejection");
const fetcher = require("./components/fetcher");

module.exports = NodeHelper.create({
  start () {
    this.config = null;
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
    const Tools = {
      sendError: (error) => {
        this.error = error;
        this.sendSocketNotification("ERROR", this.error);
      },
      sendSocketNotification: (...args) => this.sendSocketNotification(...args),
      retryTimer: () => this.tasks.retryTimer(),
      clearRetryTimer: () => this.tasks.clearRetryTimer(),
      saveChartData: (...args) => this.files.saveChartData(...args),
      refreshData: async () => {
        this.data = await this.fecher.refresh();
        this.sendSocketNotification("DATA", this.data);
      }
    };

    this.rejection = new rejection(Tools, this.config);
    this.rejection.catchUnhandledRejection();

    this.tasks = new timers(Tools, this.config);
    this.tasks.scheduleDataFetch();

    this.fecher = new fetcher(Tools, this.config);
    this.data = await this.fecher.loadCache();

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
