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
    core.info("====================================  Result ====================================");
    core.info("Validation successfully completed!");
  } catch (err) {
    core.error("====================================  Result ====================================");
    core.error(err.message);
    core.setFailed("Validation failed! \nPlease see the logs for the details.");
  }
}

main();