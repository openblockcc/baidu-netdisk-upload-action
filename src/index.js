const core = require('@actions/core');
const exec = require('@actions/exec');
const fs = require('fs');
const path = require('path');
const os = require('os');
const unzipper = require('unzipper');
const glob = require('glob');

(async () => {
  try {
    // Fixed BaiduPCS-Go version
    const VERSION = '3.9.6';

    // Inputs from workflow
    const bduss = core.getInput('bduss', { required: true });
    const stoken = core.getInput('stoken', { required: true });
    const targetPattern = core.getInput('target', { required: true });
    const remoteDir = core.getInput('remote-dir', { required: true });

    // Determine download URL based on OS platform
    const platform = os.platform();
    let downloadUrl;
    if (platform === 'win32') {
      downloadUrl = `https://github.com/qjfoidnh/BaiduPCS-Go/releases/download/v${VERSION}/BaiduPCS-Go-v${VERSION}-windows-amd64.zip`;
    } else if (platform === 'darwin') {
      downloadUrl = `https://github.com/qjfoidnh/BaiduPCS-Go/releases/download/v${VERSION}/BaiduPCS-Go-v${VERSION}-darwin-amd64.zip`;
    } else {
      downloadUrl = `https://github.com/qjfoidnh/BaiduPCS-Go/releases/download/v${VERSION}/BaiduPCS-Go-v${VERSION}-linux-amd64.zip`;
    }

    // Download the specified ZIP archive
    const zipName = path.basename(downloadUrl);
    const zipPath = path.join(process.cwd(), zipName);
    core.info(`Downloading BaiduPCS-Go from: ${downloadUrl}`);
    await exec.exec('curl', ['-L', '-o', zipPath, downloadUrl]);

    // Extract the archive using unzipper
    const extractDir = path.join(process.cwd(), 'baidupcs');
    fs.mkdirSync(extractDir, { recursive: true });
    core.info('Extracting archive using unzipper');
    await fs.createReadStream(zipPath)
      .pipe(unzipper.Extract({ path: extractDir }))
      .promise();

    // Locate the executable and ensure it is executable
    const files = fs.readdirSync(extractDir);
    let exeFile = files.find(f => f.toLowerCase().startsWith('baidupcs-go'));
    let exePath = path.join(extractDir, exeFile);
    if (platform === 'win32' && !exePath.endsWith('.exe')) {
      exePath += '.exe';
    }
    fs.chmodSync(exePath, 0o755);

    // Log in to Baidu Cloud Disk
    core.info('Logging in to Baidu Cloud Disk');
    await exec.exec(exePath, ['login', `-bduss=${bduss}`, `-stoken=${stoken}`]);

    // Find files matching the target pattern
    const matches = glob.sync(targetPattern, { nodir: true });
    if (matches.length === 0) {
      throw new Error(`No files matched pattern: ${targetPattern}`);
    }

    // Upload each matched file
    for (const filePath of matches) {
      core.info(`Uploading file: ${filePath}`);
      await exec.exec(exePath, ['upload', filePath, remoteDir]);
    }

  } catch (error) {
    core.setFailed(error.message);
  }
})();