var log = () => { /* do nothing */ };

class REJECTION {
  constructor (Tools, config) {
    this.config = config;
    if (this.config.debug) log = (...args) => { console.log("[LINKY] [REJECTION]", ...args); };
    this.sendError = (...args) => Tools.sendError(...args);
    this.retryTimer = () => Tools.retryTimer();
  }

  catchUnhandledRejection () {
    log("Live Scan Démarré...");
    process.on("unhandledRejection", (error) => {
      // catch conso API error and Enedis only
      if (error.stack.includes("MMM-Linky/node_modules/linky/") && error.response) {
        // catch Enedis error
        if (error.response.status && error.response.message && error.response.error) {
          console.error(`[LINKY] [REJECTION] [${error.response.status}] ${error.response.message}`);
          this.error = error.response.message;
          this.sendError("ERROR", this.error);
        }
        this.retryTimer();
      } else {
        // detect any errors of node_helper of MMM-Linky
        if (error.stack.includes("MMM-Linky/node_helper.js")) {
          console.error(`[LINKY] [REJECTION] ${this._citation()}`);
          console.error("[LINKY] [REJECTION] ---------");
          console.error("[LINKY] [REJECTION] node_helper Error:", error);
          console.error("[LINKY] [REJECTION] ---------");
          console.error("[LINKY] [REJECTION] Merci de signaler cette erreur aux développeurs");
          this.sendError("ERROR", `[Core Crash] ${error}`);
        } else {
          // from other modules (must never happen... but...)
          console.error("-Other-", error);
        }
      }
    });
  }

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
}

module.exports = REJECTION;
