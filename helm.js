import {spawn} from 'child_process';

export default class Helm {
  constructor(binaryPath = "./bin/helm", outputFormat = "json") {
    this.outputFormat = outputFormat;
    this.binaryPath = binaryPath;
  }

  async fetch(repoUrl, chartName, chartVersion) {
    await this.run(`repo add ${chartName}-repo ${repoUrl}`);
    await this.run(`pull ${chartName}-repo/${chartName} --version ${chartVersion}`);
  }

  async run(command) {
    let args = command.split(' ');
    let process = spawn(this.binaryPath, args);
    let stdout = '';
    let errmsg = '';
    process.stdout.on('data', function (data) {
      stdout += data;
    });
    process.stderr.on('data', function (data) {
      errmsg += data;
    });

    const result = await new Promise((resolve) =>
      process.on('close', function (exitCode) {
        if (!errmsg) {
          errmsg = undefined;
        }
        resolve({errmsg, stdout, exitCode});
      })
    );
    return result;
  }
}

