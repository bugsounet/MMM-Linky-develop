/* global Chart, ChartDataLabels */

var _linky = () => { /* do nothing */ };

Module.register("MMM-Linky", {
  defaults: {
    debug: 0,
    token: "",
    prm: "",
    //apis: ["getDailyConsumption", "getLoadCurve", "getMaxPower", "getDailyProduction", "getProductionLoadCurve"];
    apis: ["getDailyConsumption"],
    affichageInterval: 1000 * 15,
    periode: 1,
    annee_n_minus_1: 1,
    couleur: 3,
    valuebar: 1,
    valuebartextcolor: 0,
    header: 1,
    energie: 1,
    updateDate: 1,
    updateNext: 1
  },

  start () {
    Log.info("[LINKY] MMM-Linky démarré...");
    if (this.config.debug) _linky = (...args) => { console.log("[MMM-Linky]", ...args); };
    if (this.config.header) this.data.header = this.getHeaderText();
    this.chart = null;
    this.ChartJsLoaded = false;
    this.linkyData = {};
    this.linkyInterval = null;
    this.chartsData = {};
    this.timers = [];
    this.timers.CRON = null;
    this.timers.RETRY = null;
  },

  getStyles () {
    return ["MMM-Linky.css"];
  },

  getScripts () {
    return [
      this.file("node_modules/chart.js/dist/chart.umd.js"),
      this.file("node_modules/chartjs-plugin-datalabels/dist/chartjs-plugin-datalabels.min.js")
    ];
  },

  notificationReceived (notification) {
    switch (notification) {
      case "MODULE_DOM_CREATED":
        this.sendSocketNotification("INIT", this.config);
        break;
    }
  },

  socketNotificationReceived (notification, payload) {
    switch (notification) {
      case "ERROR":
        console.error("[LINKY]", payload);
        this.displayMessagerie(payload, "warn");
        break;
      case "INIT":
        _linky("Réception des premières données:", payload);
        this.linkyData = payload;
        this.displayChartInterval();
        break;
      case "DATA":
        _linky("Réception des données:", payload);
        if (payload.getDailyConsumption) this.linkyData.getDailyConsumption = payload.getDailyConsumption;
        if (payload.getLoadCurve) this.linkyData.getLoadCurve = payload.getLoadCurve;
        if (payload.getMaxPower) this.linkyData.getMaxPower = payload.getMaxPower;
        if (payload.getDailyProduction) this.linkyData.getDailyProduction = payload.getDailyProduction;
        if (payload.getProductionLoadCurve) this.linkyData.getProductionLoadCurve = payload.getProductionLoadCurve;
        _linky("Mise en place des données:", this.linkyData);
        break;
      case "TIMERS":
        _linky("Réception d'un timer:", payload);
        if (payload.type) {
          if (payload.seed === null) {
            this.timers[payload.type] = null;
          } else {
            this.timers[payload.type] = {
              seed: payload.seed,
              date: `Prochaine récupération des données: ${payload.date}`
            };
          }
        }
        this.displayTimer();
        break;
    }
  },

  getDom () {
    let wrapper = document.createElement("div");
    wrapper.id = "MMM-Linky";

    let Displayer = document.createElement("div");
    Displayer.id = "MMM-Linky_Displayer";
    Displayer.classList.add("animate__animated");
    Displayer.style.setProperty("--animate-duration", "1s");
    wrapper.appendChild(Displayer);

    let Messagerie = document.createElement("div");
    Messagerie.id = "MMM-Linky_Message";
    Messagerie.textContent = "Chargement...";
    Displayer.appendChild(Messagerie);

    let chartContainer = document.createElement("canvas");
    chartContainer.id = "MMM-Linky_Chart";
    Displayer.appendChild(chartContainer);

    let Energie = document.createElement("div");
    Energie.id = "MMM-Linky_Energie";
    Displayer.appendChild(Energie);

    let Update = document.createElement("div");
    Update.id = "MMM-Linky_Update";
    Displayer.appendChild(Update);

    let Timer = document.createElement("div");
    Timer.id = "MMM-Linky_Timer";
    Displayer.appendChild(Timer);

    return wrapper;
  },

  getHeaderText () {
    const periodTexts = {
      1: "Consommation électricité de la veille",
      2: "Consommation électricité des 3 derniers jours",
      3: "Consommation électricité des 7 derniers jours"
    };
    return periodTexts[this.config.periode] || "Consommation électricité";
  },

  displayChartInterval () {
    if (this.linkyInterval) return;
    const call = this.config.apis;
    this.displayChart(call[0], this.linkyData[call[0]]);
    if (call.length > 1) {
      var i = 1;
      this.linkyInterval = setInterval(() => {
        if (this.linkyData[call[i]]) {
          this.displayChart(call[i], this.linkyData[call[i]]);
        }
        i++;
        i = i % call.length;
      }, this.config.affichageInterval);
    }
  },

  displayChart (type, data) {
    const Displayer = document.getElementById("MMM-Linky_Displayer");
    Displayer.classList.add("animate__fadeOut");
    Displayer.style.setProperty("--animate-duration", "0s");

    if (data.labels && data.datasets) {
      try {
        //this.displayMessagerie(null, null, true);
        this.createChart(data.labels, data.datasets, type);
        _linky(`Graphique créé avec succès pour ${type}`);
        if (this.config.annee_n_minus_1 === 1) this.displayEnergie(data);
        this.displayUpdate(data);
      } catch (error) {
        console.error(`[LINKY] Erreur lors de la création du graphique ${type}:`, error);
        this.displayMessagerie(`Erreur lors de la création du graphique ${type}:`, "warn");
      }
    } else {
      this.displayMessagerie("Veuillez patienter, vos données arrivent...");
    }

    Displayer.classList.remove("animate__fadeOut");
    Displayer.style.setProperty("--animate-duration", "1s");
    Displayer.classList.add("animate__fadeIn");
    setTimeout(() => {
      Displayer.classList.remove("animate__fadeIn");
    }, 1000);
  },

  displayEnergie (data) {
    const Energie = document.getElementById("MMM-Linky_Energie");
    Energie.textContent = data.energie?.message || "";
    Energie.className = data.energie?.color;
  },

  displayUpdate (data) {
    if (this.config.updateDate === 0) return;
    const Update = document.getElementById("MMM-Linky_Update");
    Update.textContent = data.update;
  },

  displayTimer () {
    if (this.config.updateNext === 0) return;
    const Timer = document.getElementById("MMM-Linky_Timer");
    if (this.timers.RETRY?.seed < this.timers.CRON.seed) Timer.textContent = this.timers.RETRY.date;
    else Timer.textContent = this.timers.CRON.date;
  },

  displayMessagerie (text, color, hide) {
    let Messagerie = document.getElementById("MMM-Linky_Message");
    if (text) Messagerie.textContent = text;
    if (color) Messagerie.className = color;
    if (hide) Messagerie.className = "hidden";
    else Messagerie.classList.remove("hidden");
  },

  createChart (days, datasets, type) {
    const chartContainer = document.getElementById("MMM-Linky_Chart");
    var chartType = "bar";

    const displayLegend = () => {
      if (type === "getLoadCurve") return true;
      if (type === "getDailyProduction" && this.config.annee_n_minus_1 === 1) return true;
      if (type === "getProductionLoadCurve") return true;
      if (type === "getDailyConsumption" && this.config.annee_n_minus_1 === 1) return true;
      return false;
    };

    if (type === "getLoadCurve") chartType = "line";

    if (this.chart && typeof this.chart.destroy === "function") {
      this.chart.destroy();
    }

    if (datasets.length > 0 && days.length > 0) {
      Chart.register(ChartDataLabels);

      this.chart = new Chart(chartContainer, {
        type: chartType,
        data: {
          labels: days,
          datasets
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              display: displayLegend(),
              labels: { color: "white" }
            },
            datalabels: this.config.valuebar === 1
              ? {
                color: this.config.valuebartextcolor === 1 ? "white" : "black",
                anchor: "center",
                align: "center",
                rotation: -90,
                formatter: (value) => {
                  if (type === "getLoadCurve") return value;
                  else return (value / 1000).toFixed(2);
                }
              }
              : false
          },
          scales: {
            y: {
              ticks: {
                callback: (value) => {
                  if (type === "getLoadCurve") return `${value} W`;
                  if (type === "getMaxPower") return `${value / 1000} kW`;
                  else return `${value / 1000} kWh`;
                },
                color: "#fff"
              },
              title: {
                display: true,
                text: type === "getLoadCurve" ? "Consommation (W)" : (type === "getMaxPower" ? "Consommation (kW)" : "Consommation (kWh)"),
                color: "#fff"
              }
            },
            x: {
              ticks: { color: "#fff" }
            }
          },
          elements: {
            point: {
              radius: 0,
              hitRadius: 10
            }
          }
        }
      });
    } else {
      console.error("[LINKY] Impossible de créer le graphique : données invalides.");
      this.displayMessagerie("Impossible de créer le graphique : données invalides.", "warn");
    }
  }
});
