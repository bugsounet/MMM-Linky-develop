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
    this.consumptionData = {};
    this.chart = null;
    this.ChartJsLoaded = false;
    this.data.header = this.getHeaderText();
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

  getChartColors () {
    const colorSchemes = {
      1: ["rgba(245, 234, 39, 0.8)", "rgba(245, 39, 230, 0.8)"],
      2: ["rgba(252, 255, 0, 0.8)", "rgba(13, 255, 0, 0.8)"],
      3: ["rgba(255, 255, 255, 0.8)", "rgba(0, 255, 242, 0.8)"],
      4: ["rgba(255, 125, 0, 0.8)", "rgba(220, 0, 255, 0.8)"]
    };

    return colorSchemes[this.config.couleur] || colorSchemes[1];
  },

  getHeaderText () {
    const periodTexts = {
      1: "Consommation électricité de la veille",
      2: "Consommation électricité des 3 derniers jours",
      3: "Consommation électricité des 7 derniers jours"
    };
    return periodTexts[this.config.periode] || "Consommation électricité";
  },

  getDom () {
    let wrapper = document.createElement("div");
    wrapper.id = "MMM-Linky";

    if (Object.keys(this.consumptionData).length > 0) {
      _linky("Données de consommation trouvées, préparation du graphique...", this.consumptionData);
      const days = [];
      const datasets = [];
      const colors = this.getChartColors();

      let index = 0;
      for (const year in this.consumptionData) {
        const data = this.consumptionData[year].sort((a, b) => {
          if (a.month === b.month) {
            return a.day - b.day;
          }
          return a.month - b.month;
        });

        const values = data.map((item) => item.value);

        if (index === 0) {
          days.push(
            ...data.map(
              (item) => `${item.day}-${
                ["Error", "janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"][item.month]
              }`
            )
          );
        }

        datasets.push({
          label: year,
          data: values,
          backgroundColor: colors[index],
          borderColor: colors[index].replace("0.8", "1"),
          borderWidth: 1
        });
        index++;
      }

      _linky("Données des graphiques : ", { labels: days, datasets });

      let chartContainer = document.createElement("canvas");
      chartContainer.id = "MMM-Linky_Chart";
      wrapper.appendChild(chartContainer);

      try {
        this.createChart(chartContainer, days, datasets);
        _linky("Graphique créé avec succès");
      } catch (error) {
        console.error("[LINKY] Erreur lors de la création du graphique : ", error);
      }
      const messageElement = document.createElement("div");
      messageElement.id = "MMM-Linky_Energie";
      wrapper.appendChild(messageElement);

    } else {
      // todo: a revoir (id/css)
      let waitingMessage = document.createElement("div");
      waitingMessage.id = "MMM-Linky_Message";
      waitingMessage.textContent = "Veuillez patienter, vos données arrivent...";
      waitingMessage.style.color = "#ffffff";
      waitingMessage.style.textAlign = "center";
      waitingMessage.style.marginTop = "10px";
      wrapper.appendChild(waitingMessage);
    }

    return wrapper;
  },

  displayEnergie () {
    const chartContainer = document.getElementById("MMM-Linky_Chart");

    if (chartContainer.width > 0 && chartContainer.height > 0) {
      const messageElement = document.getElementById("MMM-Linky_Energie");
      const currentYearTotal = this.calculateTotalConsumption(new Date().getFullYear().toString());
      const previousYearTotal = this.calculateTotalConsumption((new Date().getFullYear() - 1).toString());

      let message, color, periodText;

      switch (this.config.periode) {
        case 1:
          periodText = "le dernier jour";
          break;
        case 2:
          periodText = "les 3 derniers jours";
          break;
        case 3:
          periodText = "les 7 derniers jours";
          break;
        default:
          periodText = "période inconnue";
      }

      if (currentYearTotal < previousYearTotal) {
        message = `Félicitations, votre consommation d'énergie a baissé sur ${periodText} par rapport à l'année dernière !`;
        color = "green";
      } else if (currentYearTotal > previousYearTotal) {
        message = `Attention, votre consommation d'énergie a augmenté sur ${periodText} par rapport à l'année dernière !`;
        color = "red";
      } else {
        message = `Votre consommation d'énergie est stable sur ${periodText} par rapport à l'année dernière.`;
        color = "yellow";
      }

      messageElement.textContent = message;
      messageElement.className = color;
    } else {
      console.error("[LINKY] Le graphique n'a pas été affiché correctement.");
    }
  },

  notificationReceived (notification) {
    switch (notification) {
      case "MODULE_DOM_CREATED":
        this.sendSocketNotification("INIT", this.config);
        break;
      case "MODULE_DOM_UPDATED":
        _linky("Fin du updateDom(), mise à jour du texte d'information Energie.");
        this.displayEnergie();
        break;
    }
  },

  socketNotificationReceived (notification, payload) {
    switch (notification) {
      case "ERROR":
        console.error("[LINKY]", payload);
        this.sendNotification("SHOW_ALERT", {
          type: "notification",
          title: "MMM-Linky",
          message: payload,
          timer: 10000
        });
        break;
      case "CONSUMPTION_DATA":
        this.consumptionData = payload;
        this.updateDom(1000);
        break;
    }
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
    }
  },

  calculateTotalConsumption (year) {
    let total = 0;
    if (this.consumptionData[year]) {
      this.consumptionData[year].forEach((data) => {
        total += data.value;
      });
    }
    return total;
  }
});
