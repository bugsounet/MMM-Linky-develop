/* global Chart, ChartDataLabels */

var _linky = () => { /* do nothing */ };

Module.register("MMM-Linky", {
  defaults: {
    debug: false,
    token: "",
    prm: "",
    periode: 1,
    annee_n_minus_1: 1,
    couleur: 3,
    valuebar: 1,
    valuebartextcolor: 0,
    energie: 1,
    updateDate: 1,
    updateNext: 1
  },

  start () {
    Log.info("[LINKY] MMM-Linky démarré...");
    if (this.config.debug) _linky = (...args) => { console.log("[MMM-Linky]", ...args); };
    this.chart = null;
    this.ChartJsLoaded = false;
    if (this.data.header) this.data.header = undefined;
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
      case "DATA":
        _linky("Réception des données:", payload);
        this.chartsData = payload;
        this.displayChart();
        break;
      case "TIMERS":
        _linky("Réception d'un timer:", payload);
        if (payload.type) {
          if (payload.seed === null) {
            this.timers[payload.type] = null;
          } else {
            this.timers[payload.type] = {
              seed: payload.seed,
              date: `[${payload.type}] Prochaine récupération des données: ${payload.date}`
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

    let header = document.createElement("div");
    header.id = "MMM-Linky_Header";
    header.textContent = this.getHeaderText();
    wrapper.appendChild(header);

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

  displayChart () {
    const Displayer = document.getElementById("MMM-Linky_Displayer");
    Displayer.classList.add("animate__fadeOut");
    Displayer.style.setProperty("--animate-duration", "0s");

    if (this.chartsData.labels && this.chartsData.datasets) {
      try {
        this.displayMessagerie(null, null, true);
        this.createChart(this.chartsData.labels, this.chartsData.datasets);
        _linky("Graphique créé avec succès");
        if (this.config.annee_n_minus_1 === 1) this.displayEnergie();
        this.displayUpdate();
      } catch (error) {
        console.error("[LINKY] Erreur lors de la création du graphique : ", error);
        this.displayMessagerie("Erreur lors de la création du graphique", "warn");
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

  displayEnergie () {
    if (this.config.energie === 0) return;
    const Energie = document.getElementById("MMM-Linky_Energie");
    Energie.textContent = this.chartsData.energie.message;
    Energie.className = this.chartsData.energie.color;
  },

  displayUpdate () {
    if (this.config.updateDate === 0) return;
    const Update = document.getElementById("MMM-Linky_Update");
    Update.textContent = this.chartsData.update;
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

  createChart (days, datasets) {
    const chartContainer = document.getElementById("MMM-Linky_Chart");

    if (this.chart && typeof this.chart.destroy === "function") {
      this.chart.destroy();
    }

    if (datasets.length > 0 && days.length > 0) {
      Chart.register(ChartDataLabels);

      this.chart = new Chart(chartContainer, {
        type: "bar",
        data: {
          labels: days,
          datasets
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              display: this.config.annee_n_minus_1 === 1 ? true : false,
              labels: { color: "white" }
            },
            datalabels: this.config.valuebar === 1
              ? {
                color: this.config.valuebartextcolor === 1 ? "white" : "black",
                anchor: "center",
                align: "center",
                rotation: -90,
                formatter: (value) => (value / 1000).toFixed(2)
              }
              : false
          },
          scales: {
            y: {
              ticks: {
                callback: (value) => `${value / 1000} kWh`,
                color: "#fff"
              },
              title: {
                display: true,
                text: "Consommation (kWh)",
                color: "#fff"
              }
            },
            x: {
              ticks: { color: "#fff" }
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
