const core = require('@actions/core');
const exec = require('@actions/exec');
const fs = require('fs');
const path = require('path');
const os = require('os');
const unzipper = require('unzipper');
const glob = require('glob');

(async () => {
    try {
        const VERSION = '3.9.6';

        const bduss = core.getInput('bduss', { required: true });
        const stoken = core.getInput('stoken', { required: true });
        const targetPattern = core.getInput('target', { required: true });
        const remoteDir = core.getInput('remote-dir', { required: true });

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

        const zipPath = path.join(process.cwd(), assetName);
        core.info(`📥 Downloading BaiduPCS-Go from: ${downloadUrl}`);
        await exec.exec('curl', ['-L', '-o', zipPath, downloadUrl]);

        if (!fs.existsSync(zipPath)) {
            throw new Error(`❌ ZIP file was not downloaded: ${zipPath}`);
        } else {
            core.info(`✅ ZIP file exists: ${zipPath}`);
        }

        const extractDir = path.join(process.cwd(), 'baidupcs');
        fs.mkdirSync(extractDir, { recursive: true });
        core.info('📦 Extracting archive...');
        await fs.createReadStream(zipPath)
            .pipe(unzipper.Extract({ path: extractDir }))
            .promise();

        core.info(`📁 Extracted contents to: ${extractDir}`);
        const allFiles = glob.sync('**/*', { cwd: extractDir });
        core.info(`📋 Files after extraction:\n${allFiles.join('\n')}`);

        const exePattern = platform === 'win32' ? '**/BaiduPCS-Go.exe' : '**/BaiduPCS-Go';
        const executables = glob.sync(exePattern, {
            cwd: extractDir,
            absolute: true,
            nocase: true
        });

        if (executables.length === 0) {
            throw new Error(`❌ Executable not found using pattern: ${exePattern}`);
        }
        const exePath = executables[0];
        core.info(`✅ Found executable: ${exePath}`);

        try {
            fs.chmodSync(exePath, 0o755);
            core.info('🔐 Executable permission set to 755');
        } catch (chmodErr) {
            core.warning(`⚠️ chmod failed: ${chmodErr.message}`);
        }

        // Check if executable actually exists before running
        if (!fs.existsSync(exePath)) {
            throw new Error(`❌ Executable path does not exist: ${exePath}`);
        }

        core.info('🔐 Logging into Baidu Cloud Disk...');
        await exec.exec(exePath, ['login', `-bduss=${bduss}`, `-stoken=${stoken}`]);

        const matches = glob.sync(targetPattern, { nodir: true });
        if (matches.length === 0) throw new Error(`❌ No files matched pattern: ${targetPattern}`);

        for (const filePath of matches) {
            core.info(`📤 Uploading file: ${filePath}`);
            await exec.exec(exePath, ['upload', filePath, remoteDir]);
        }

    } catch (error) {
        core.setFailed(`🚨 ${error.message}`);
    }
})();
