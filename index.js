const ImageValidator = require('./image_validator');
const core = require('@actions/core');
const fs = require('fs');

async function main() {
  try {
    let imageValidator = new ImageValidator();
    const appList = core.getInput('app_list').split(',');
    for (let app of appList) {
      await imageValidator.getImagesFromChart(`${app}/base/resources.yaml`);
      imageValidator.validate(`${app}/image/image-values.yaml`);
    }
  } catch (err) {
    core.error(err.message);
    core.setFailed("Error Occurred");
  }
}

main();