const core = require('@actions/core');
const exec = require('@actions/exec');
const fs = require('fs');
const path = require('path');
const os = require('os');
const unzipper = require('unzipper');
const glob = require('glob');

(async () => {
    try {
    // Fixed BaiduPCS-Go version (latest release asset naming)
        const VERSION = '3.9.6';

        // Inputs from workflow
        const bduss = core.getInput('bduss', {required: true});
        const stoken = core.getInput('stoken', {required: true});
        const targetPattern = core.getInput('target', {required: true});
        const remoteDir = core.getInput('remote-dir', {required: true});

        // Determine download URL based on OS platform/arch
        const platform = os.platform();
        const arch = os.arch();
        let assetName;
        if (platform === 'win32') {
            if (arch === 'x64') assetName = `BaiduPCS-Go-v${VERSION}-windows-x64.zip`;
            else if (arch === 'arm64') assetName = `BaiduPCS-Go-v${VERSION}-windows-arm.zip`;
            else assetName = `BaiduPCS-Go-v${VERSION}-windows-x86.zip`;
        } else if (platform === 'darwin') {
            if (arch === 'arm64') assetName = `BaiduPCS-Go-v${VERSION}-darwin-osx-arm64.zip`;
            else assetName = `BaiduPCS-Go-v${VERSION}-darwin-osx-amd64.zip`;
        } else if (arch === 'arm64') assetName = `BaiduPCS-Go-v${VERSION}-linux-arm64.zip`;
        else if (arch === 'arm') assetName = `BaiduPCS-Go-v${VERSION}-linux-arm.zip`;
        else assetName = `BaiduPCS-Go-v${VERSION}-linux-amd64.zip`;
        const downloadUrl = `https://github.com/qjfoidnh/BaiduPCS-Go/releases/download/v${VERSION}/${assetName}`;

        // Download the specified ZIP archive
        const zipPath = path.join(process.cwd(), assetName);
        core.info(`Downloading BaiduPCS-Go from: ${downloadUrl}`);
        await exec.exec('curl', ['-L', '-o', zipPath, downloadUrl]);

        // Extract the archive using unzipper
        const extractDir = path.join(process.cwd(), 'baidupcs');
        fs.mkdirSync(extractDir, {recursive: true});
        core.info('Extracting archive using unzipper');
        await fs.createReadStream(zipPath)
            .pipe(unzipper.Extract({path: extractDir}))
            .promise();

        // Locate the executable recursively in extractDir
        const exePattern = platform === 'win32' ? '**/BaiduPCS-Go.exe' : '**/BaiduPCS-Go';
        const executables = glob.sync(exePattern, {
            cwd: extractDir,
            absolute: true,
            nocase: true
        }).filter(p => {
            try {
                return fs.statSync(p).isFile();
            } catch {
                return false;
            }
        });
        if (executables.length === 0) {
            throw new Error(`Executable not found in path: ${extractDir}`);
        }
        const exePath = executables[0];
        fs.chmodSync(exePath, 0o755);

        // Log in to Baidu Cloud Disk
        core.info('Logging in to Baidu Cloud Disk');
        await exec.exec(exePath, ['login', `-bduss=${bduss}`, `-stoken=${stoken}`]);

        // Find files matching the target pattern
        const matches = glob.sync(targetPattern, {nodir: true});
        if (matches.length === 0) throw new Error(`No files matched pattern: ${targetPattern}`);

        // Upload each matched file
        for (const filePath of matches) {
            core.info(`Uploading file: ${filePath}`);
            await exec.exec(exePath, ['upload', filePath, remoteDir]);
        }

    } catch (error) {
        core.setFailed(error.message);
    }
})();
