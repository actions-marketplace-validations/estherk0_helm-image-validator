const spawn = require('child_process').spawn;
const fs = require('fs');

module.exports = class Helm {
  constructor(binaryPath = "./bin/helm", outputFormat = "json", tempDir = "temp") {
    this.outputFormat = outputFormat;
    this.binaryPath = binaryPath;
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

