var log = () => { /* do nothing */ };

class API {
  constructor (Tools, config) {
    this.Linky = null;
    this.config = config;
    if (this.config.debug) log = (...args) => { console.log("[LINKY] [API]", ...args); };
    this.sendError = (error) => Tools.sendError(error);
    this.retryTimer = () => Tools.retryTimer();
    this.api = ["getDailyConsumption", "getLoadCurve", "getMaxPower", "getDailyProduction", "getProductionLoadCurve"];

  }

  // Importation de la librairie linky (dynamic import)
  async loadLinky () {
    const loaded = await import("linky");
    return loaded;
  }

  // Initialisation de l'api linky
  async initLinky (callback) {
    const { Session } = await this.loadLinky();
    try {
      this.Linky = new Session(this.config.token, this.config.prm);
      log("API linky Prête");
      if (callback) callback();
    } catch (error) {
      console.error(`[LINKY] [API] ${error}`);
      this.sendError(error.message);
    }
  }

  // Demande des datas selon l'API
  request (type, date) {
    if (this.api.indexOf(type) === -1) {
      this.sendError(`[API] API non reconnu: ${type}`);
      return;
    }
    return new Promise((resolve) => {
      if (!this.Linky) {
        this.initLinky(async () => {
          resolve(await this.request(type, date));
        });
      } else {
        this.Linky[type](date.startDate, date.endDate)
          .then((result) => {
            resolve(result);
          })
          .catch((error) => {
            this.catchError(error);
            resolve({ error: true });
          });
      }
    });
  }

  catchError (error) {
    if (error.message) {
      console.error(`[LINKY] [API] [Erreur ${error.code}] ${error.message}`);
      let msgError = `[Erreur ${error.code}] ${error.message}`;
      this.sendError(msgError);
    } else {
      // must never Happen...
      console.error("[LINKY] [API] !TO DEBUG!", error);
    }
    //this.retryTimer();
  }
}
module.exports = API;
