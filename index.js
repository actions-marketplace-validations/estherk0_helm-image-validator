import ImageValidator from './image_validator.js';

async function main() {
  try {
    let imageValidator = new ImageValidator();
    await imageValidator.getImagesFromChart(`/Users/1112456/github/decapod-base-yaml/lma/base/resources.yaml`);
    imageValidator.validate(`/Users/1112456/github/decapod-base-yaml/lma/image/image-values.yaml`);
  } catch (err) {
    console.error(err.message);
    throw err;
  }
}

main();