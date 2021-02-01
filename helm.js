const spawn = require('child_process').spawn;
const fs = require('fs');
const core = require('@actions/core');

module.exports = class Helm {
  constructor(outputFormat = "json", tempDir = "temp") {
    this.outputFormat = outputFormat;
    this.binaryPath = core.getInput('helm_binary_path');
    this.tempDir = tempDir;
    !fs.existsSync(tempDir) && fs.mkdirSync(tempDir);
  }

  async fetch(repoUrl, chartName, chartVersion) {
    await this.run(`repo add ${chartName}-repo ${repoUrl}`);
    await this.run(`pull ${chartName}-repo/${chartName} --version ${chartVersion} --untar --untardir ${this.tempDir}`);
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

