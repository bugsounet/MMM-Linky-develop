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
    valuebartextcolor: 0
  },

  start () {
    Log.info("[LINKY] MMM-Linky démarré...");
    if (this.config.debug) _linky = (...args) => { console.log("[MMM-Linky]", ...args); };
    this.chart = null;
    this.ChartJsLoaded = false;
    this.data.header = this.getHeaderText();
    this.chartsData = {};
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
        _linky("Réception des données :", payload);
        this.chartsData = payload;
        this.displayChart();
        break;
    }
  },

  getDom () {
    let wrapper = document.createElement("div");
    wrapper.id = "MMM-Linky";
    wrapper.classList.add("animate__animated");
    wrapper.style.setProperty("--animate-duration", "1s");

    let Messagerie = document.createElement("div");
    Messagerie.id = "MMM-Linky_Message";
    Messagerie.textContent = "Chargement...";
    wrapper.appendChild(Messagerie);

    let chartContainer = document.createElement("canvas");
    chartContainer.id = "MMM-Linky_Chart";
    wrapper.appendChild(chartContainer);

    const Energie = document.createElement("div");
    Energie.id = "MMM-Linky_Energie";
    wrapper.appendChild(Energie);

    const Update = document.createElement("div");
    Update.id = "MMM-Linky_Update";
    wrapper.appendChild(Update);

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
    const Linky = document.getElementById("MMM-Linky");
    Linky.classList.add("animate__fadeOut");
    Linky.style.setProperty("--animate-duration", "0s");

    const chartContainer = document.getElementById("MMM-Linky_Chart");

    if (this.chartsData.labels && this.chartsData.datasets) {
      try {
        this.displayMessagerie(null, null, true);
        this.createChart(chartContainer, this.chartsData.labels, this.chartsData.datasets);
        _linky("Graphique créé avec succès");
        this.displayEnergie();
        this.displayUpdate();
      } catch (error) {
        console.error("[LINKY] Erreur lors de la création du graphique : ", error);
        this.displayMessagerie("Erreur lors de la création du graphique", "warn");
      }
    } else {
      this.displayMessagerie("Veuillez patienter, vos données arrivent...");
    }

    Linky.classList.remove("animate__fadeOut");
    Linky.style.setProperty("--animate-duration", "1s");
    Linky.classList.add("animate__fadeIn");
    setTimeout(() => {
      Linky.classList.remove("animate__fadeIn");
    }, 1000);
  },

  displayEnergie () {
    const Energie = document.getElementById("MMM-Linky_Energie");
    Energie.textContent = this.chartsData.energie.message;
    Energie.className = this.chartsData.energie.color;
  },

  displayUpdate () {
    const Update = document.getElementById("MMM-Linky_Update");
    Update.textContent = this.chartsData.update;
  },

  displayMessagerie (text, color, hide) {
    let Messagerie = document.getElementById("MMM-Linky_Message");
    if (text) Messagerie.textContent = text;
    if (color) Messagerie.className = color;
    if (hide) Messagerie.className = "hidden";
    else Messagerie.classList.remove("hidden");
  },

  createChart (chartContainer, days, datasets) {
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
                color: "#ffffff"
              },
              title: {
                display: true,
                text: "Consommation (kWh)",
                color: "#ffffff"
              }
            },
            x: {
              ticks: { color: "#ffffff" }
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
