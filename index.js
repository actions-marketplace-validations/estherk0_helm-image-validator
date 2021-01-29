import YAML from 'yaml';
import fs from 'fs';
import Helm from './helm.js';
let helm = new Helm();

let imageMap = {};

function searchImageKV(values, prevKey, resMap) {
  if (!values || typeof values != 'object') {
    return resMap;
  }
  for(let key of Object.keys(values)) {
    if (values[key] && values[key].repository && values[key].tag) {
      if (prevKey) {
        resMap[`${prevKey}.${key}.repository`] = values[key].repository;
        resMap[`${prevKey}.${key}.tag`] = values[key].tag;
      } else {
        resMap[`${key}.repository`] = values[key].repository;
        resMap[`${key}.tag`] = values[key].tag;
      }
    } else {
      if (prevKey) {
        resMap = searchImageKV(values[key], `${prevKey}.${key}`, resMap);
      } else {
        resMap = searchImageKV(values[key], key, resMap);
      }
    }
  }
  return resMap;
}

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

    try {
      // download helm chart
      await helm.fetch(chart.repoUrl, chart.name, chart.version);
      const valueFile = fs.readFileSync(`${chart.name}/values.yaml`, 'utf8');
      const valueDoc = YAML.parse(valueFile);
      const res = searchImageKV(valueDoc, '', {});
      imageMap[metadataName] = res;
      // create a file for helmrelease's value override.
      // let valueOverride = doc.getIn(['spec', 'values']).toString();
    } catch (err) {
      console.log(err);
      throw new Error(err);
    }
  }
  console.log(imageMap);
}
getImagesFromChart('lma');
