import YAML from 'yaml';
import fs from 'fs';
import Helm from './helm.js';
let helm = new Helm();

let imageMap = {};

async function getImagesFromChart(appName) {
  const file = fs.readFileSync(`/Users/1112456/github/decapod-base-yaml/${appName}/base/resources.yaml`, 'utf8');
  const docs = YAML.parseAllDocuments(file);
  for(const doc of docs) {
    let chart = {
      name: doc.getIn(['spec', 'chart', 'name']),
      version: doc.getIn(['spec', 'chart', 'version']),
      repoUrl: doc.getIn(['spec', 'chart', 'repository'])
    };
    let metadataName = doc.getIn(['metadata', 'name']);
    imageMap[metadataName] = [];

    // create a file for helmrelease's value override.
    let valueOverride = doc.getIn(['spec', 'values']).toString();
    await fs.writeFileSync(`${metadataName}-vo.json`, valueOverride, 'utf8');

    try {
      // download helm chart
      // TODO: fetch failed error 처리
      await helm.fetch(chart.repoUrl, chart.name, chart.version);

      let result = await helm.run(`template -f ${metadataName}-vo.json ${chart.name}-${chart.version}.tgz`);
      if (result.exitCode) {
        throw new Error(result.errmsg);
      }
      // find string pattern; image: "repository:tag".
      let imageStr = result.stdout.match(/(image:).*/ig);
      if (!imageStr) { // not found image values in this chart.
        continue;
      }
      imageStr.forEach(str => {
        let idx = str.indexOf(':');
        let image = str.slice(idx+2);
        image = image.replace(/\"/g, '');
        imageMap[metadataName].push(image);
      });;
      console.log(imageMap[metadataName]);
    } catch (err) {
      throw new Error(err);
    }
  }
}
getImagesFromChart('lma');
