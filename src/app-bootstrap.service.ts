import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChromeManagerService } from './chrome/chrome-manager.service';
import { CrashResultCatcherService } from './crash/crash-result-catcher.service';
import { CsvHandlerService } from './csv/csv-handler.service';
import { ShutdownHandlerService } from './shutdown/shutdown-handler.service';

@Injectable()
export class AppBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(AppBootstrapService.name);
  private stopMonitoring: (() => void) | null = null;
  private readonly closeBrowserOnStop: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly chromeManager: ChromeManagerService,
    private readonly crashResultCatcher: CrashResultCatcherService,
    private readonly csvHandler: CsvHandlerService,
    private readonly shutdownHandler: ShutdownHandlerService,
  ) {
    // Check if we should close the browser on stop (default: true for backward compatibility)
    this.closeBrowserOnStop = this.configService.get<string>('CLOSE_DEBUG_BROWSER_WHEN_BOT_STOP', 'true') === 'true';
  }

  async onModuleInit() {
    // Optionally auto-start on module init
    // Uncomment the line below if you want automatic startup
    // await this.start();
  }

  async start(): Promise<void> {
    try {
      this.logger.log('=== BC.Game Crash Result Catcher ===\n');

      // Start Chrome
      this.logger.log('Starting Chrome...');
      await this.chromeManager.start();

      // Wait for Chrome to be ready
      this.logger.log('Waiting for Chrome to be ready...');
      await this.chromeManager.waitForReady();
      this.logger.log('✓ Chrome is ready');

      // Connect to Chrome
      this.logger.log('Connecting to Chrome...');
      await this.crashResultCatcher.connect();
      this.logger.log('✓ Connected to Chrome');

      // Wait for crash banner
      this.logger.log('Waiting for crash banner...');
      await this.crashResultCatcher.waitForCrashBanner(40000);
      this.logger.log('✓ Crash banner found');

      // Get monitor interval from config
      const monitorInterval = parseInt(
        this.configService.get<string>('MONITOR_INTERVAL') || '500',
        10,
      );

      this.logger.log('\n=== Monitoring crash results ===');
      this.logger.log('Press Ctrl+C to stop\n');

      // Monitor for new crash results with automatic CSV saving
      this.stopMonitoring = await this.crashResultCatcher.monitorCrashResults(
        (result) => {
          this.csvHandler.save(result);
        },
        monitorInterval,
      );

      // Register stop function with shutdown handler
      this.shutdownHandler.setStopMonitoringFunction(this.stopMonitoring);

      this.logger.log('✓ Monitoring started with automatic CSV saving');
    } catch (error) {
      this.logger.error(`\n✗ Error: ${error.message}`);
      this.logger.error(error.stack);
      
      // Close Chrome only if CLOSE_DEBUG_BROWSER_WHEN_BOT_STOP is true
      if (this.closeBrowserOnStop) {
        try {
          await this.chromeManager.close();
        } catch (closeError) {
          this.logger.error(`Error closing Chrome: ${closeError.message}`);
        }
      } else {
        this.logger.log('Chrome browser left open (CLOSE_DEBUG_BROWSER_WHEN_BOT_STOP=false)');
      }
      throw error;
    }
  }

  stop(): void {
    if (this.stopMonitoring) {
      this.stopMonitoring();
      this.stopMonitoring = null;
      this.logger.log('Monitoring stopped');
    }
  }
}

