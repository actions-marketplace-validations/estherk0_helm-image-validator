const fs = require('fs');
const Helm = require('./helm');
const YAML = require('yaml');
let helm = new Helm();

module.exports = class ImageValidator {
  constructor() {
    this.imageList = {};
  }

  searchImageKV(values, prevKey, resMap) {
    if (!values || typeof values != 'object') {
      return resMap;
    }
    for(let key of Object.keys(values)) {
      if (values[key] && values[key].repository && values[key].tag) { // most common pattern of image value
        let repoPath = prevKey ? `${prevKey}.${key}.repository` : `${key}.repository`;
        let tagPath = prevKey ? `${prevKey}.${key}.tag` : `${key}.tag`;
        resMap[repoPath] = values[key].repository;
        resMap[tagPath] = values[key].tag;
      } else if (key == 'images' && values[key].tags) { // pattern for openstack chart
        for (let subkey in values[key].tags) {
          let currKey = prevKey ? `${prevKey}.${key}.tags.${subkey}` : `${key}.tags.${subkey}`; 
          resMap[currKey] = values[key].tags[subkey];
        }
      } else {
        let currKey = prevKey ? `${prevKey}.${key}` : key; 
        resMap = this.searchImageKV(values[key], currKey, resMap);
      }
    }
    return resMap;
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
      let metadataName = doc.getIn(['metadata', 'name']);

      try {
        // download helm chart
        await helm.fetch(chart.repoUrl, chart.name, chart.version);
        const valueFile = fs.readFileSync(`temp/${chart.name}/values.yaml`, 'utf8');
        const valueDoc = YAML.parse(valueFile);
        const res = this.searchImageKV(valueDoc, '', {});
        this.imageList[metadataName] = res;
        // TODO: apply helmrelease's value override.
        // let valueOverride = doc.getIn(['spec', 'values']).toString();
      } catch (err) {
        console.log(err);
        throw new Error(err);
      }
    }
  }


  validate(targetFilePath) {
    if (!fs.existsSync(targetFilePath)) {
      throw new Error(`${targetFilePath} doesn't exist.`);
    }
    const file = fs.readFileSync(targetFilePath, 'utf8');
    const valueDoc = YAML.parse(file);
    let errmsg = '';
    let targetList = {};
    // convert image values into same scheme with `this.imageList`.
    for (let chart of valueDoc.charts) {
      targetList[chart.name] = chart.override;
    }

    for(let chartName in this.imageList) {
      const src = this.imageList[chartName];
      const target = targetList[chartName];
      if (!target) {
        errmsg += `[ERROR] Missing chart ${chartName} in image-values.yaml\n`;
        continue;
      }
      for (let imagePath in src) {
        if (!target[imagePath]) {
          errmsg += `[ERROR] Missing value.\n\t Chart Name: ${chartName}
          ${imagePath}: ${this.imageList[chartName][imagePath]}\n`;
        } else if (typeof target[imagePath] == 'string' && target[imagePath].indexOf('/') > 0) { // registry url
          let temp = target[imagePath].substr(target[imagePath].indexOf('/')+1);
          temp = temp.replace(/library\//, ''); // remove "library/" for a specific use-case "docker.io/library".
          if (!src[imagePath].includes(temp)) {
            errmsg += `[ERROR] Not valid value.\n\tChart Name: ${chartName}\n\t ${imagePath}: ${target[imagePath]}
            => ${imagePath}: ${src[imagePath]}`;
          }
        } 
        else if (target[imagePath] != src[imagePath]) { // tags
          errmsg += `[ERROR] Not valid value.\n\tChart Name: ${chartName}\n\t ${imagePath}: ${target[imagePath]}
          => ${imagePath}: ${src[imagePath]}\n`;
        }
      }
    }
    if (errmsg) throw new Error(errmsg);
  }
}