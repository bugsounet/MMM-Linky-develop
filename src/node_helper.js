const NodeHelper = require("node_helper");

const timers = require("./components/timers");
const files = require("./components/files");
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
      sendError: (...args) => {
        this.error = args[1];
        this.sendSocketNotification(...args);
      },
      sendSocketNotification: (...args) => this.sendSocketNotification(...args),
      retryTimer: () => this.tasks.retryTimer(),
      clearRetryTimer: () => this.tasks.clearRetryTimer(),
      saveChartData: (...args) => this.files.saveChartData(...args),
      getConsumptionData: () => this.fecher.getData("getDailyConsumption")
    };

    this.rejection = new rejection(Tools, this.config);
    this.rejection.catchUnhandledRejection();

    this.tasks = new timers(Tools, this.config);
    this.tasks.scheduleDataFetch();

    this.files = new files(Tools, this.config);
    this.fecher = new fetcher(Tools, this.config);

    this.consumptionData = await this.files.readChartData("getDailyConsumption");
    if (Object.keys(this.consumptionData).length) {
      this.sendSocketNotification("DATA", this.consumptionData);
    }
    else {
      this.consumptionData = await this.fecher.getData("getDailyConsumption");
      if (Object.keys(this.consumptionData).length) {
        this.sendSocketNotification("DATA", this.consumptionData);
      }
    }
  },

  // Utilisation du cache interne lors d'une utilisation du "mode Server"
  initWithCache () {
    console.log(`[LINKY] [Cache] MMM-Linky Version: ${require("./package.json").version} Revison: ${require("./package.json").rev}`);
    if (this.error) this.sendSocketNotification("ERROR", this.error);
    if (Object.keys(this.consumptionData).length) this.sendSocketNotification("DATA", this.consumptionData);
    if (Object.keys(this.tasks.timers).length) this.tasks.sendTimers();
  }
});
