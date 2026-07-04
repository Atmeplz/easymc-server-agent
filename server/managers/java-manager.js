/*
 * AI maintenance note: Keep all code comments in English.
 */
/**
 * Java Manager - detects and downloads Java runtimes.
 * Supports PATH Java, JAVA_HOME, and downloaded bundled JREs.
 * Downloads JRE packages through the Adoptium API v3.
 */
const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Minecraft version to Java version mapping.
const MC_JAVA_MAP = [
  { test: (v) => compareVersion(v, '26.1') >= 0, javaVersion: 25 },
  { test: (v) => compareVersion(v, '1.20.5') >= 0 && compareVersion(v, '1.21.11') <= 0, javaVersion: 21 },
  { test: (v) => compareVersion(v, '1.18') >= 0 && compareVersion(v, '1.20.4') <= 0, javaVersion: 17 },
  { test: (v) => compareVersion(v, '1.17') >= 0 && compareVersion(v, '1.17.1') <= 0, javaVersion: 17 },
  { test: (v) => compareVersion(v, '1.16.5') <= 0, javaVersion: 8 },
];

/**
 * Compare simple version strings.
 */
function compareVersion(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

class JavaManager {
  constructor(config) {
    this.config = config;
    this.runtimeDir = path.resolve(config?.java?.runtimeDir || './java-runtime');
    this.detectedJavas = [];
  }

  /**
   * Resolve the required Java version for a Minecraft version.
   */
  getRequiredJavaVersion(mcVersion) {
    for (const entry of MC_JAVA_MAP) {
      if (entry.test(mcVersion)) return entry.javaVersion;
    }
    return 21; // Java 21 is the default recommendation.
  }

  /**
   * Detect all available Java runtimes.
   */
  async detectJava() {
    this.detectedJavas = [];

    // 1. Check java on PATH.
    try {
      const output = execSync('java -version 2>&1', { encoding: 'utf-8', timeout: 5000 });
      const parsed = this.parseJavaVersion(output);
      if (parsed) {
        this.detectedJavas.push({
          path: 'java',
          version: output.trim(),
          majorVersion: parsed.major,
          source: 'system',
        });
      }
    } catch (e) {
      // java is not on PATH.
    }

    // 2. Check JAVA_HOME.
    if (process.env.JAVA_HOME) {
      const javaExe = path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
      if (fs.existsSync(javaExe)) {
        const j = await this.checkJavaAt(javaExe);
        if (j) {
          this.detectedJavas.push({ ...j, source: 'JAVA_HOME' });
        }
      }
    }

    // 3. Check downloaded bundled JREs.
    if (fs.existsSync(this.runtimeDir)) {
      for (const dir of fs.readdirSync(this.runtimeDir)) {
        const match = dir.match(/^jre-(\d+)$/);
        if (match) {
          const javaPath = this.getBundledJavaPath(parseInt(match[1]));
          if (fs.existsSync(javaPath)) {
            const j = await this.checkJavaAt(javaPath);
            if (j) {
              this.detectedJavas.push({ ...j, source: 'bundled' });
            }
          }
        }
      }
    }

    return {
      found: this.detectedJavas.length > 0,
      javas: this.detectedJavas,
    };
  }

  /**
   * Check the Java version at a specific path.
   */
  async checkJavaAt(javaPath) {
    return new Promise((resolve) => {
      exec(`"${javaPath}" -version`, { encoding: 'utf-8', timeout: 5000 }, (err, stdout, stderr) => {
        if (err) return resolve(null);
        const output = (stderr || stdout || '').trim();
        const parsed = this.parseJavaVersion(output);
        if (!parsed) return resolve(null);
        resolve({ path: javaPath, version: output, majorVersion: parsed.major });
      });
    });
  }

  /**
   * Parse java -version output.
   */
  parseJavaVersion(output) {
    // Match version "1.8.0_362", version "17.0.8", or version "21.0.1".
    const match = output.match(/version "(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
    if (!match) return null;
    let major = parseInt(match[1]);
    // Java 8 and older use the 1.x.y version format.
    if (major === 1) major = parseInt(match[2]);
    return { major };
  }

  /**
   * Get the bundled JRE java executable path.
   */
  getBundledJavaPath(javaVersion) {
    const dir = path.join(this.runtimeDir, `jre-${javaVersion}`);
    if (process.platform === 'win32') {
      return path.join(dir, 'bin', 'java.exe');
    }
    return path.join(dir, 'bin', 'java');
  }

  /**
   * Choose the best Java runtime for a Minecraft version.
   */
  selectJavaForMcVersion(mcVersion) {
    const required = this.getRequiredJavaVersion(mcVersion);
    const candidates = this.detectedJavas.filter(j => j.majorVersion >= required);
    if (candidates.length === 0) return null;
    // Prefer bundled runtimes with an exact version match.
    const bundled = candidates.find(j => j.source === 'bundled' && j.majorVersion === required);
    return bundled || candidates[0];
  }

  /**
   * Download a JRE through the Adoptium API v3.
   */
  async downloadJre(javaVersion, onProgress) {
    const os = this.getOsKey();
    const arch = this.getArchKey();
    const url = `https://api.adoptium.net/v3/binary/latest/${javaVersion}/ga/${os}/${arch}/jre/hotspot/normal/eclipse`;

    const targetDir = path.join(this.runtimeDir, `jre-${javaVersion}`);
    fs.mkdirSync(targetDir, { recursive: true });

    const ext = os === 'windows' ? 'zip' : 'tar.gz';
    const archivePath = path.join(this.runtimeDir, `jre-${javaVersion}.${ext}`);

    console.log(`[JavaManager] 下载 JRE ${javaVersion}...`);
    console.log(`[JavaManager] URL: ${url}`);

    // Download.
    const response = await axios({
      method: 'GET',
      url,
      responseType: 'stream',
      maxRedirects: 10,
      timeout: 300000, // Five-minute timeout.
    });

    const total = parseInt(response.headers['content-length'] || 0);
    let downloaded = 0;

    const writer = fs.createWriteStream(archivePath);

    response.data.on('data', (chunk) => {
      downloaded += chunk.length;
      if (onProgress) {
        onProgress({
          downloaded,
          total,
          percent: total ? Math.round(downloaded / total * 100) : 0,
        });
      }
    });

    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    console.log(`[JavaManager] 下载完成，解压中...`);

    // Extract.
    if (ext === 'zip') {
      const extract = require('extract-zip');
      await extract(archivePath, { dir: targetDir });
    } else {
      const tar = require('tar');
      await tar.x({ file: archivePath, cwd: targetDir, strip: 1 });
    }

    // Clean up the archive.
    fs.unlinkSync(archivePath);

    // Validate.
    const javaPath = this.getBundledJavaPath(javaVersion);
    const check = await this.checkJavaAt(javaPath);
    if (!check) {
      throw new Error(`JRE ${javaVersion} 下载后验证失败`);
    }

    console.log(`[JavaManager] JRE ${javaVersion} 安装成功: ${javaPath}`);

    // Detect again.
    await this.detectJava();

    return { path: javaPath, version: check.version, majorVersion: javaVersion };
  }

  getOsKey() {
    switch (process.platform) {
      case 'win32': return 'windows';
      case 'darwin': return 'mac';
      case 'linux': return 'linux';
      default: return 'linux';
    }
  }

  getArchKey() {
    switch (process.arch) {
      case 'x64': return 'x64';
      case 'arm64': return 'aarch64';
      case 'ia32': return 'x86';
      default: return 'x64';
    }
  }

  /**
   * Format a Java version string.
   */
  formatJavaVersion(versionStr) {
    const m = versionStr.match(/version "?(\d+)/);
    return m ? `Java ${m[1]}` : versionStr;
  }
}

module.exports = JavaManager;
