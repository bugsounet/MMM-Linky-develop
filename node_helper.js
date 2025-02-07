const NodeHelper = require("node_helper");

var log = () => { /* do nothing */ };

module.exports = NodeHelper.create({

  start () {
    this.Linky = null;
    this.config = null;
    this.dates = [];
    this.consumptionData = {};
  },

  socketNotificationReceived (notification, payload) {
    switch (notification) {
      case "INIT":
        this.config = payload;
        this.initialize();
        break;
    }
  },

  // intialisation de MMM-Linky
  async initialize () {
    console.log(`[LINKY] MMM-Linky Version: ${require("./package.json").version} Revison: ${require("./package.json").rev}`);
    if (this.config.debug) log = (...args) => { console.log("[LINKY]", ...args); };
    log("Config:", this.config);
    this.Dates = await this.getDates();
    if (!this.Dates.length) return;
    log("Dates:", this.Dates);
    const { Session } = await this.loadLinky();
    try {
      this.Linky = new Session(this.config.token, this.config.prm);
    } catch (error) {
      console.error(`[LINKY] ${error}`);
      this.sendSocketNotification("ERROR", error.message);
      return;
    }
    this.scheduleDataFetch();
  },

  // Récupération planifié des données
  scheduleDataFetch () {
    this.getConsumptionData();
    setInterval(() => {
      this.getConsumptionData();
    }, 1000 * 60 * 60);
  },

  // Récupération des données
  async getConsumptionData () {
    this.consumptionData = {};
    await Promise.all(this.Dates.map(
      async (date) => {
        await this.sendConsumptionRequest(date).then((result) => {
          if (result.start && result.end && result.interval_reading) {
            const year = result.start.split("-")[0];
            log(`-${year}- Données reçues de l'API :`, result);
            this.consumptionData[year] = [];

            result.interval_reading.forEach((reading) => {
              const day = parseInt(reading.date.split("-")[2]);
              const month = parseInt(reading.date.split("-")[1]);
              const value = parseFloat(reading.value);

              const isDuplicate = this.consumptionData[year].some(
                (entry) => entry.day === day && entry.month === month && entry.value === value
              );

              if (!isDuplicate) {
                this.consumptionData[year].push({ day, month, value });
              }
            });
          } else {
            console.error("Format inattendu des données :", result);
          }
        });
      }
    ));
    log("Final data:", this.consumptionData);
    if (Object.keys(this.consumptionData).length) this.sendSocketNotification("CONSUMPTION_DATA", this.consumptionData);
  },

  // Demande des datas selon l'API
  sendConsumptionRequest (date) {
    return new Promise((resolve) => {
      this.Linky.getDailyConsumption(date.startDate, date.endDate).then((result) => {
        resolve(result);
      });
    });
  },

  // importation de la librairie linky (dynamic impor)
  async loadLinky () {
    const loaded = await import("linky");
    return loaded;
  },

  // cacul des dates périodique
  calculateDates (yearOffset = 0) {
    const today = new Date();
    today.setFullYear(today.getFullYear() - yearOffset);
    const endDate = today.toISOString().split("T")[0];
    const startDate = new Date(today);

    switch (this.config.periode) {
      case 1:
        startDate.setDate(today.getDate() - 1);
        break;
      case 2:
        startDate.setDate(today.getDate() - 3);
        break;
      case 3:
        startDate.setDate(today.getDate() - 7);
        break;
      default:
        console.error("[Linky] periode invalide.");
        this.sendSocketNotification("ERROR", "periode invalide.");
        return null;
    }

    return { startDate: startDate.toISOString().split("T")[0], endDate };
  },

  // Récupere les Dates pour l'intérogation de l'API
  getDates () {
    var Dates = [];
    return new Promise((resolve) => {
      var date = this.calculateDates();
      if (date) Dates.push(date);
      if (this.config.annee_n_minus_1 === 1) {
        date = this.calculateDates(1);
        if (date) Dates.push(date);
      }
      resolve(Dates);
    });
  }
});
