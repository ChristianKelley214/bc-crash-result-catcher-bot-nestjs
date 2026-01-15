import { Injectable, Logger, OnApplicationShutdown, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CrashResultCatcherService } from '../crash/crash-result-catcher.service';
import { ChromeManagerService } from '../chrome/chrome-manager.service';

@Injectable()
export class ShutdownHandlerService implements OnApplicationShutdown {
  private readonly logger = new Logger(ShutdownHandlerService.name);
  private stopMonitoring: (() => void) | null = null;
  private readonly closeBrowserOnStop: boolean;

  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => CrashResultCatcherService))
    private readonly crashResultCatcher: CrashResultCatcherService,
    private readonly chromeManager: ChromeManagerService,
  ) {
    // Check if we should close the browser on stop (default: true for backward compatibility)
    this.closeBrowserOnStop = this.configService.get<string>('CLOSE_DEBUG_BROWSER_WHEN_BOT_STOP', 'true') === 'true';
    this.setupShutdownHandlers();
  }

  setStopMonitoringFunction(stopFn: () => void): void {
    this.stopMonitoring = stopFn;
  }

  private async performShutdown(): Promise<void> {
    this.logger.log('\n\nShutting down...');
    
    // Stop monitoring if active
    if (this.stopMonitoring) {
      this.stopMonitoring();
      this.logger.log('✓ Stopped monitoring');
    }
    
    // Disconnect from Chrome
    try {
      await this.crashResultCatcher.disconnect();
      this.logger.log('✓ Disconnected from Chrome');
    } catch (error) {
      this.logger.error(`Error disconnecting from Chrome: ${error.message}`);
    }
    
    // Close Chrome only if CLOSE_DEBUG_BROWSER_WHEN_BOT_STOP is true
    if (this.closeBrowserOnStop) {
      try {
        await this.chromeManager.close();
        this.logger.log('✓ Chrome closed');
      } catch (error) {
        this.logger.error(`Error closing Chrome: ${error.message}`);
      }
    } else {
      this.logger.log('✓ Chrome browser left open (CLOSE_DEBUG_BROWSER_WHEN_BOT_STOP=false)');
    }
  }

  private setupShutdownHandlers(): void {
    const shutdown = async () => {
      await this.performShutdown();
      // Exit process for signal handlers (NestJS will handle exit for onApplicationShutdown)
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }

  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(`Application shutdown signal received: ${signal || 'unknown'}`);
    await this.performShutdown();
  }
}

