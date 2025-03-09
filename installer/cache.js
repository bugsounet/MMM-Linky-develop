const utils = require("./utils");

async function main () {
  // Let's start !
  utils.empty();
  utils.info(`Delete Cache ${utils.moduleName()} v${utils.moduleVersion()}`);
  utils.empty();
  await deleteCache();
  utils.success("Done!");
}

async function deleteCache () {
  utils.info("➤ Cleaning json data files...");
  if (utils.isWin()) {
    await utils.execCMD(`del ${utils.getModuleRoot()}\\data\\*.json`);
  } else {
    await utils.execCMD(`rm -f ${utils.getModuleRoot()}/data/*.json`);
  }
}

main();
