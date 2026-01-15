import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn, exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as http from 'http';
import { promisify } from 'util';

const execAsync = promisify(exec);

@Injectable()
export class ChromeManagerService implements OnModuleDestroy {
  private readonly logger = new Logger(ChromeManagerService.name);
  private debugPort: number;
  private userDataDir: string;
  private chromePath: string | null = null;
  private chromeStartedByUs = false;

  constructor(private configService: ConfigService) {
    this.debugPort = parseInt(
      this.configService.get<string>('DEBUG_PORT') || '9225',
      10,
    );
    this.userDataDir = path.join(
      os.tmpdir(),
      `chrome_debug_${this.debugPort}`,
    );
  }

  private findChromePath(): string | null {
    const possiblePaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(
        os.homedir(),
        'AppData',
        'Local',
        'Google',
        'Chrome',
        'Application',
        'chrome.exe',
      ),
    ];

    for (const chromePath of possiblePaths) {
      if (fs.existsSync(chromePath)) {
        return chromePath;
      }
    }

    return null;
  }

  private setupUserDataDir(): void {
    // Clear existing user data directory to reset language preferences
    if (fs.existsSync(this.userDataDir)) {
      this.logger.log('Clearing cached Chrome preferences...');
      try {
        fs.rmSync(this.userDataDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore errors if directory is in use
      }
    }

    // Create user data directory if it doesn't exist
    if (!fs.existsSync(this.userDataDir)) {
      fs.mkdirSync(this.userDataDir, { recursive: true });
    }
  }

  private async isPortInUse(): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get(`http://localhost:${this.debugPort}`, (res) => {
        resolve(true);
      });
      req.on('error', () => {
        resolve(false);
      });
      req.setTimeout(1000, () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  async start(): Promise<void> {
    // Check if Chrome is already running on this port
    const portInUse = await this.isPortInUse();
    if (portInUse) {
      this.logger.log(`✓ Chrome is already running on port ${this.debugPort}`);
      this.logger.log('Using existing Chrome instance...\n');
      this.chromeStartedByUs = false;
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.logger.log(
        `Starting Chrome with remote debugging on port ${this.debugPort}...\n`,
      );

      // Find Chrome executable
      this.chromePath = this.findChromePath();
      if (!this.chromePath) {
        this.logger.error('ERROR: Could not find Chrome.exe');
        this.logger.error(
          'Please install Google Chrome or update the path in the script.',
        );
        reject(new Error('Chrome executable not found'));
        return;
      }

      this.logger.log(`Found Chrome at: ${this.chromePath}`);

      // Setup user data directory
      this.setupUserDataDir();

      // Get target URL from environment or use default
      const targetUrl =
        this.configService.get<string>('CHROME_TARGET_URL') ||
        'https://bc.game/en/game/crash?type=classic';

      // Chrome command line arguments
      const chromeArgs = [
        `--remote-debugging-port=${this.debugPort}`,
        `--user-data-dir=${this.userDataDir}`,
        '--lang=en-US',
        '--accept-lang=en-US,en',
        '--disable-translate',
        '--disable-features=TranslateUI',
        '--disable-sync',
        '--no-first-run',
        '--no-default-browser-check',
        targetUrl,
      ];

      // Start Chrome
      this.logger.log('Starting Chrome...');
      const chromeProcess = spawn(this.chromePath, chromeArgs, {
        detached: true,
        stdio: 'ignore',
      });

      chromeProcess.unref(); // Allow the parent process to exit independently

      chromeProcess.on('error', (error) => {
        this.logger.error(`✗ Error starting Chrome: ${error.message}`);
        reject(error);
      });

      this.chromeStartedByUs = true;
      this.logger.log('\n✓ Chrome started with remote debugging enabled.');
      this.logger.log(`✓ Chrome opened to English version: ${targetUrl}`);

      // Wait a moment for Chrome to start, then resolve
      // The actual readiness will be checked by waitForReady()
      setTimeout(() => {
        resolve();
      }, 2000);
    });
  }

  async waitForReady(maxAttempts = 30, delay = 2000): Promise<boolean> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        await new Promise((resolve, reject) => {
          const req = http.get(`http://localhost:${this.debugPort}`, (res) => {
            resolve(true);
          });
          req.on('error', () => {
            reject(false);
          });
          req.setTimeout(1000, () => {
            req.destroy();
            reject(false);
          });
        });
        this.logger.log('✓ Chrome debug port is available');
        return true;
      } catch (error) {
        if (i < maxAttempts - 1) {
          this.logger.log(
            `Waiting for Chrome to be ready... (${i + 1}/${maxAttempts})`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    throw new Error(
      `Chrome debug port ${this.debugPort} did not become available in time`,
    );
  }

  async close(): Promise<void> {
    // Only close Chrome if we started it
    if (!this.chromeStartedByUs) {
      this.logger.log(
        `✓ Chrome on port ${this.debugPort} was started externally, not closing it.`,
      );
      return;
    }

    this.logger.log(`Closing Chrome on port ${this.debugPort}...`);

    try {
      const { stdout } = await execAsync(
        `netstat -ano | findstr :${this.debugPort}`,
      );

      if (!stdout) {
        this.logger.log('✓ Chrome already closed or not found');
        return;
      }

      // Extract PID from netstat output
      // Format: TCP    0.0.0.0:9225    0.0.0.0:0    LISTENING    12345
      const lines = stdout.trim().split('\n');
      const pids = new Set<string>();

      lines.forEach((line) => {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid)) {
          pids.add(pid);
        }
      });

      if (pids.size === 0) {
        this.logger.log('✓ Chrome already closed or not found');
        return;
      }

      // Kill the process(es) using the port and their children
      const killPromises = Array.from(pids).map((pid) => {
        return execAsync(`taskkill /F /PID ${pid} /T`).catch(() => {
          // Ignore errors if process is already closed
        });
      });

      await Promise.all(killPromises);
      this.logger.log('✓ Chrome closed');
    } catch (error) {
      this.logger.log('✓ Chrome already closed or not found');
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.close();
  }
}

