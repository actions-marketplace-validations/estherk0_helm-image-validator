const fs = require('fs');
const Helm = require('./helm');
const YAML = require('yaml');
const core = require('@actions/core');
let helm = new Helm();

module.exports = class ImageValidator {
  constructor() {
    this.imageList = {};
  }

  searchImageKV(values, prevKey, res) {
    if (!values || typeof values != 'object') {
      return res;
    }
    for(let key of Object.keys(values)) {
      if (values[key] && (values[key].repository || values[key].tag)) { // most common pattern of image value
        if (values[key].repository) {
          let repoPath = prevKey ? `${prevKey}.${key}.repository` : `${key}.repository`;
          res[repoPath] = values[key].repository;
        }
        if (values[key].tag) {
          let tagPath = prevKey ? `${prevKey}.${key}.tag` : `${key}.tag`;
          if (!tagPath.includes('targetLogs')) { // 'tag' can be used in different way. i.e. fluentbits.logs.tag
            res[tagPath] = values[key].tag;
          }
        }
      } else if (key == 'images' && values[key].tags) { // pattern for openstack chart
        for (let subkey in values[key].tags) {
          let currKey = prevKey ? `${prevKey}.${key}.tags.${subkey}` : `${key}.tags.${subkey}`; 
          res[currKey] = values[key].tags[subkey];
        }
      } else {
        let currKey = prevKey ? `${prevKey}.${key}` : key; 
        res = this.searchImageKV(values[key], currKey, res);
      }
    }
    return res;
  }

  async getImagesFromChart(baseFilePath) {
    if (!fs.existsSync(baseFilePath)) {
      throw new Error(`${baseFilePath} doesn't exist.`);
    }
    const file = fs.readFileSync(baseFilePath, 'utf8');
    const docs = YAML.parseAllDocuments(file);
    for(const doc of docs) {
      let chart = {
        name: doc.getIn(['spec', 'chart', 'name']),
        version: doc.getIn(['spec', 'chart', 'version']),
        repoUrl: doc.getIn(['spec', 'chart', 'repository'])
      };

      try {
        core.debug(`>>> Trying to fetch the helm chart "${chart.name}:${chart.version}"...`);
        // download helm chart
        await helm.fetch(chart.repoUrl, chart.name, chart.version);
        const upstreamFile = fs.readFileSync(`temp/${chart.name}/values.yaml`, 'utf8');
        const upstreamDoc = YAML.parse(upstreamFile);
        core.debug(`>>> Searching imave values from "${chart.name}:${chart.version}"...`);
        let res = this.searchImageKV(upstreamDoc, '', {});
        // override helmrelease's value override.
        let helmreleaseValue = JSON.parse(doc.getIn(['spec', 'values']).toString());
        this.imageList[doc.getIn(['metadata', 'name'])] = this.searchImageKV(helmreleaseValue, '', res);
      } catch (err) {
        console.log(err);
        throw new Error(err);
      }
    }
  }

  validate(targetFilePath) {
    core.debug(`>>> Compare the image values in image-values.yaml with origin image values...`);
    if (!fs.existsSync(targetFilePath)) {
      throw new Error(`${targetFilePath} doesn't exist.`);
    }
    const file = fs.readFileSync(targetFilePath, 'utf8');
    const valueDoc = YAML.parse(file);
    let errDetails = {}, errCount = 1, targetList = {};
    // convert image values into same scheme with `this.imageList`.
    for (let chart of valueDoc.charts) {
      targetList[chart.name] = chart.override;
    }

    // initialize the errors object
    for (let chartName in this.imageList) {
      errDetails[chartName] = [];
    }

    for(let chartName in this.imageList) {
      const src = this.imageList[chartName];
      const target = targetList[chartName];
      if (!target) {
        errDetails[chartName].push(`#${errCount++}. Missing chart ${chartName} in image-values.yaml\n`);
        continue;
      }
      for (let imagePath in src) {
        if (!target[imagePath]) {
          errDetails[chartName].push(`#${errCount++}. Missing value:\n\t 
          ${imagePath}: ${this.imageList[chartName][imagePath]}\n`);
        } else if (typeof target[imagePath] == 'string' && target[imagePath].indexOf('/') > 0) { // registry url
          let filtered = target[imagePath].substr(target[imagePath].indexOf('/')+1).replace(/library\//, '');
          if (!src[imagePath].includes(filtered)) {
            errDetails[chartName].push(`#${errCount++}. Invalid value:\n\t
            => ${imagePath}: ${src[imagePath]}\n`);
          }
        } 
        else if (target[imagePath] != src[imagePath]) { // tags
          errDetails[chartName].push(`#${errCount++}. Invalid value:\n\t ${imagePath}: ${target[imagePath]}
          => ${imagePath}: ${src[imagePath]}\n`);
        }
      }
    }
    this.printValidateResult(errCount - 1, errDetails);
  }

  printValidateResult(errCount, errDetails) {
    core.info("====================================  Result ====================================");
    if (errCount) {
      core.error(`Total errors: ${errCount}`);
      for (let chartName in errDetails) {
        if (!errDetails[chartName].length) {
          continue;
        }
        core.error(`>>>>>> Chart name: ${chartName}`);
        core.error(`${errDetails[chartName]}`);
      }
      throw new Error(errCount);
    } else {
      core.info(`Total errors: ${errCount}`);
      core.info("Validation successfully completed!");
    }
  }
}