const ImageValidator = require('./image_validator');
const core = require('@actions/core');

async function main() {
  try {
    let imageValidator = new ImageValidator();
    const appList = core.getInput('app_list').split(',');
    for (let app of appList) {
      await imageValidator.getImagesFromChart(`${app}/base/resources.yaml`);
      imageValidator.validate(`${app}/image/image-values.yaml`);
    }
  } catch (err) {
    core.setFailed("Validation failed! \nPlease see the logs for the details.");
  }
}

main();