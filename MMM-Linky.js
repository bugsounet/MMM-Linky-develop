/* global Chart, ChartDataLabels */

Module.register("MMM-Linky", {
  defaults: {
    url: "https://conso.boris.sh/api/daily_consumption",
    token: "votre-token-ici",
    prm: "123456789",
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
    this.getData();

    setTimeout(() => {
      this.updateDom();
    }, 50000);
  },

  getStyles () {
    return ["MMM-Linky.css"];
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

  getData () {
    const dates = this.calculateDates();
    if (!dates) return;

    this.sendSocketNotification("GET_CONSUMPTION_DATA", {
      url: this.config.url,
      token: this.config.token,
      prm: this.config.prm,
      startDate: dates.startDate,
      endDate: dates.endDate,
      period: this.config.periode
    });

    if (this.config.annee_n_minus_1 === 1) {
      const previousYearDates = this.calculateDates(1);
      if (previousYearDates) {
        this.sendSocketNotification("GET_CONSUMPTION_DATA", {
          url: this.config.url,
          token: this.config.token,
          prm: this.config.prm,
          startDate: previousYearDates.startDate,
          endDate: previousYearDates.endDate,
          period: this.config.periode
        });
      }
    }
  },

  getDom () {
    let wrapper = document.createElement("div");

    const header = document.createElement("div");
    header.innerHTML = this.getHeaderText();
    header.classList.add("header");
    wrapper.appendChild(header);

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
                ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"][item.month]
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

      let waitingMessage = document.createElement("div");
      waitingMessage.innerHTML = "Veuillez patienter, vos données arrivent...";
      waitingMessage.style.color = "#ffffff";
      waitingMessage.style.textAlign = "center";
      waitingMessage.style.marginTop = "10px";
      wrapper.appendChild(waitingMessage);

      this.ensureChartJsLoaded(() => {
        try {
          this.createChart(chartContainer, days, datasets);
          console.log("Graphique créé avec succès");

          wrapper.removeChild(waitingMessage);

          setTimeout(() => {
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
          }, 1000);

        } catch (error) {
          console.error("Erreur lors de la création du graphique : ", error);
        }
      });

    } else {
      console.log("Aucune donnée de consommation trouvée.");
    }

    return wrapper;
  },

  socketNotificationReceived (notification, payload) {
    if (notification === "CONSUMPTION_SCHEDULE") {
      this.getData();
      return;
    }

    if (notification === "CONSUMPTION_DATA") {
      console.log("Données brutes reçues de l'API dans le module : ", payload);

      const payloadArray = Array.isArray(payload) ? payload : [payload];

      payloadArray.forEach((item) => {
        if (item.start && item.end && item.interval_reading) {
          const { start, interval_reading } = item;
          const year = start.split("-")[0];

          if (!this.consumptionData[year]) {
            this.consumptionData[year] = [];
          }

          interval_reading.forEach((reading) => {
            const day = parseInt(reading.date.split("-")[2]);
            const month = parseInt(reading.date.split("-")[1]) - 1;
            const value = parseFloat(reading.value);

            const isDuplicate = this.consumptionData[year].some(
              (entry) => entry.day === day && entry.month === month && entry.value === value
            );

            if (!isDuplicate) {
              this.consumptionData[year].push({ day, month, value });
            }
          });
        } else {
          console.error("Format inattendu des données :", item);
        }
      });

      this.updateDom();
    }
  },

  calculateDates (yearOffset = 0) {
    const today = new Date();
    today.setFullYear(today.getFullYear() - yearOffset);
    const endDate = today.toISOString().split("T")[0];

    let startDate;

    switch (this.config.periode) {
      case 1:
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 1);
        break;
      case 2:
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 3);
        break;
      case 3:
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 7);
        break;
      default:
        Log.error("MMM-Linky: periode invalide.");
        return null;
    }

    return { startDate: startDate.toISOString().split("T")[0], endDate };
  },

  loadChartJs (callback) {
    if (typeof Chart === "undefined") {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/chart.js";
      script.onload = callback;
      document.head.appendChild(script);
    } else {
      callback();
    }
  },

  ensureChartJsLoaded (callback) {
    if (!this.ChartJsLoaded) {
      this.loadChartJs(() => {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels";
        script.onload = () => {
          this.ChartJsLoaded = true;
          callback();
        };
        document.head.appendChild(script);
      });
    } else {
      callback();
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
