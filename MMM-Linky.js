/* global Chart, ChartDataLabels */

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
    Log.info("MMM-Linky démarré...");
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

    if (Object.keys(this.consumptionData).length > 0) {
      console.log("Données de consommation trouvées, préparation du graphique...", this.consumptionData);
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

      console.log("Données des graphiques : ", { labels: days, datasets });

      let chartContainer = document.createElement("canvas");
      wrapper.appendChild(chartContainer);

      try {
        this.createChart(chartContainer, days, datasets);
        console.log("Graphique créé avec succès");

        // todo: A afficher APRES Le dom créé
        if (chartContainer.width > 0 && chartContainer.height > 0) {

          const currentYearTotal = this.calculateTotalConsumption(new Date().getFullYear().toString());
          const previousYearTotal = this.calculateTotalConsumption((new Date().getFullYear() - 1).toString());

          let message = "";
          let color = "";
          let periodText = "";

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

          // todo: a revoir (mettre ID et utiliser CSS)
          const messageElement = document.createElement("div");
          messageElement.innerHTML = `<span style="color: ${color};">${message}</span>`;
          messageElement.style.textAlign = "left";
          messageElement.style.fontSize = "16px";
          messageElement.style.maxWidth = "100%";
          messageElement.style.wordWrap = "break-word";
          messageElement.style.lineHeight = "1.2";
          messageElement.style.marginTop = "10px";
          wrapper.appendChild(messageElement);
        } else {
          console.log("Le graphique n'a pas été affiché correctement, tentative de réinitialisation.");
        }

      } catch (error) {
        console.error("Erreur lors de la création du graphique : ", error);
      }

    } else {
      // todo: a revoir (id/css)
      let waitingMessage = document.createElement("div");
      waitingMessage.textContent = "Veuillez patienter, vos données arrivent...";
      waitingMessage.style.color = "#ffffff";
      waitingMessage.style.textAlign = "center";
      waitingMessage.style.marginTop = "10px";
      wrapper.appendChild(waitingMessage);
    }

    return wrapper;
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
      console.log("Impossible de créer le graphique : données invalides.");
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
