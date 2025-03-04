const cron = require("node-cron");
const { CronExpressionParser } = require("cron-parser");
const dayjs = require("dayjs");

var log = () => { /* do nothing */ };

class TIMERS {
  constructor (Tools, config) {
    this.config = config;
    if (this.config.debug) log = (...args) => { console.log("[LINKY] [TIMERS]", ...args); };
    this.sendSocketNotification = (...args) => Tools.sendSocketNotification(...args);
    this.refreshData = () => Tools.refreshData();
    this.timers = {};
    this.timer = null;
    this.cronExpression = "0 0 14 * * *";
  }

  // Retry Timer en cas d'erreur, relance la requete 2 heures apres
  retryTimer () {
    if (this.timer) this.clearRetryTimer();
    this.timer = setTimeout(() => {
      log("Retry-Timer: Démarrage");
      this.refreshData();
    }, 1000 * 60 * 60 * 2);
    let job = dayjs(dayjs() + this.timer._idleNext.expiry);
    log("Retry-Timer planifié:", job.format("[Le] DD/MM/YYYY -- HH:mm:ss"));
    this.sendTimer(job.valueOf(), job.format("[Le] DD/MM/YYYY -- HH:mm:ss"), "RETRY");
  }

  // Retry Timer kill
  clearRetryTimer () {
    if (!this.timer) return;
    log("Retry-Timer: Arrêt");
    clearTimeout(this.timer);
    this.timer = null;
    this.sendTimer(null, null, "RETRY");
  }

  // Récupération planifié des données
  scheduleDataFetch () {
    const randomMinute = Math.floor(Math.random() * 59);
    const randomSecond = Math.floor(Math.random() * 59);

    this.cronExpression = `${randomSecond} ${randomMinute} 14 * * *`;
    cron.schedule(this.cronExpression, () => {
      log("Exécution de la tâche planifiée de récupération des données.");
      this.refreshData();
      this.displayNextCron();
    });
    this.displayNextCron();
  }

  // Affiche la prochaine tache Cron
  displayNextCron () {
    const next = CronExpressionParser.parse(this.cronExpression, { tz: "Europe/Paris" });
    let nextCron = dayjs(next.next().toString());
    log("Prochaine tâche planifiée:", nextCron.format("[Le] DD/MM/YYYY -- HH:mm:ss"));
    this.sendTimer(nextCron.valueOf(), nextCron.format("[Le] DD/MM/YYYY -- HH:mm:ss"), "CRON");
  }

  // Envoi l'affichage de la date du prochain update
  sendTimer (seed, date, type) {
    let timer = {
      seed: seed,
      date: date,
      type: type
    };
    this.timers[type] = timer;
    this.sendSocketNotification("TIMERS", timer);
  }

  // envoi l'affichage de tous les timers (server mode)
  sendTimers () {
    const timers = Object.values(this.timers);
    timers.forEach((timer) => {
      this.sendSocketNotification("TIMERS", timer);
    });
  }
}
module.exports = TIMERS;
