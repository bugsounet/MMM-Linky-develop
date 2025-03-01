const dayjs = require("dayjs");
require("dayjs/locale/fr");

var log = () => { /* do nothing */ };

class CHART {
  constructor (Tools, config) {
    this.config = config;
    if (this.config.debug) log = (...args) => { console.log("[LINKY] [CHART]", ...args); };
    this.sendSocketNotification = (...args) => Tools.sendSocketNotification(...args);
    this.chart = {};
  }

  // création des données chartjs
  setChartValue (detail) {
    const days = [];
    const datasets = [];
    const colors = this.getChartColors();

    let index = 0;
    for (const year in detail) {
      const data = detail[year];
      const values = data.map((item) => item.value);

      if (index === 0) {
        days.push(...data.map((item) => dayjs(item.date).locale("fr").format("DD MMM")));
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

    log("Données des graphiques :", { labels: days, data: datasets });

    if (datasets.length > 1 && datasets[0].data.length !== datasets[1].data.length) {
      console.warn("[LINKY] [CHART] Il manque des données pour une des 2 années.");
      console.warn("[LINKY] [CHART] L'affichage risque d'être corrompu.");
    }

    this.chart = {
      labels: days,
      datasets: datasets,
      energie: this.config.annee_n_minus_1 === 1 ? this.setEnergie(detail) : null,
      update: `Données du ${dayjs().format("DD/MM/YYYY -- HH:mm:ss")}`,
      seed: dayjs().valueOf()
    };

    return this.chart;
  }

  // Selection schémas de couleurs
  getChartColors () {
    const colorSchemes = {
      1: ["rgba(245, 234, 39, 0.8)", "rgba(245, 39, 230, 0.8)"],
      2: ["rgba(252, 255, 0, 0.8)", "rgba(13, 255, 0, 0.8)"],
      3: ["rgba(255, 255, 255, 0.8)", "rgba(0, 255, 242, 0.8)"],
      4: ["rgba(255, 125, 0, 0.8)", "rgba(220, 0, 255, 0.8)"]
    };
    return colorSchemes[this.config.couleur] || colorSchemes[1];
  }

  // cacul des dates périodique
  calculateDates () {
    const endDate = dayjs().format("YYYY-MM-DD");
    var start = dayjs();

    switch (this.config.periode) {
      case 1:
        start = start.subtract(1, "day");
        break;
      case 2:
        start = start.subtract(3, "day");
        break;
      case 3:
        start = start.subtract(7, "day");
        break;
      default:
        console.error("[LINKY] [CHART] période invalide.");
        this.sendSocketNotification("ERROR", "période invalide.");
        return null;
    }

    if (this.config.annee_n_minus_1 === 1) {
      start = start.subtract(1, "year");
    }

    const startDate = dayjs(start).format("YYYY-MM-DD");

    return { startDate, endDate };
  }

  // Création du message Energie
  setEnergie (data) {
    const currentYearTotal = this.calculateTotalConsumption(dayjs().get("year"), data);
    const previousYearTotal = this.calculateTotalConsumption(dayjs().subtract(1, "year").get("year"), data);

    var message, color, periodText;

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

    return {
      message: message,
      color: color
    };
  }

  // Calcul de la comsommation totale
  calculateTotalConsumption (year, datas) {
    let total = 0;
    if (datas[year]) {
      datas[year].forEach((data) => {
        total += data.value;
      });
    }
    return total;
  }
}
module.exports = CHART;
