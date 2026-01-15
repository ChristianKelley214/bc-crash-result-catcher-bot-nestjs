import { Controller, Get, Post, Query } from '@nestjs/common';
import { CrashResultCatcherService, CrashResult } from './crash-result-catcher.service';
import { CsvHandlerService } from '../csv/csv-handler.service';
import { ShutdownHandlerService } from '../shutdown/shutdown-handler.service';

@Controller('crash')
export class CrashController {
  private stopMonitoring: (() => void) | null = null;

  constructor(
    private readonly crashResultCatcher: CrashResultCatcherService,
    private readonly csvHandler: CsvHandlerService,
    private readonly shutdownHandler: ShutdownHandlerService,
  ) {}

  @Get('connect')
  async connect() {
    try {
      await this.crashResultCatcher.connect();
      return { success: true, message: 'Connected to Chrome browser' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @Get('last-result')
  async getLastResult(@Query('save') save?: string) {
    try {
      const result = await this.crashResultCatcher.getLastCrashResult();
      
      // Optionally save to CSV if save=true query parameter is provided
      if (save === 'true') {
        try {
          this.csvHandler.save(result);
          return { success: true, data: result, saved: true };
        } catch (saveError) {
          return { success: true, data: result, saved: false, saveError: saveError.message };
        }
      }
      
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @Get('all-results')
  async getAllResults() {
    try {
      const results = await this.crashResultCatcher.getAllCrashResults();
      return { success: true, data: results };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @Get('balance')
  async getBalance() {
    try {
      const balance = await this.crashResultCatcher.getAccountBalance();
      return { success: true, balance };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @Post('monitor')
  async startMonitoring(@Query('save') save?: string) {
    try {
      // Stop existing monitoring if any
      if (this.stopMonitoring) {
        this.stopMonitoring();
      }

      const saveToCsv = save === 'true';
      
      this.stopMonitoring = await this.crashResultCatcher.monitorCrashResults(
        (result: CrashResult) => {
          console.log('New crash result:', result);
          
          // Automatically save to CSV if enabled
          if (saveToCsv) {
            try {
              this.csvHandler.save(result);
            } catch (saveError) {
              console.error('Failed to save to CSV:', saveError.message);
            }
          }
        },
      );
      
      // Register stop function with shutdown handler for graceful shutdown
      this.shutdownHandler.setStopMonitoringFunction(this.stopMonitoring);
      
      return {
        success: true,
        message: `Monitoring started. ${saveToCsv ? 'Results will be saved to CSV.' : 'Check console for results.'}`,
        csvSaving: saveToCsv,
        stopEndpoint: 'POST /crash/monitor/stop',
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @Post('monitor/stop')
  async stopMonitoringHandler() {
    try {
      if (this.stopMonitoring) {
        this.stopMonitoring();
        this.stopMonitoring = null;
        // Clear the shutdown handler's reference
        this.shutdownHandler.setStopMonitoringFunction(() => {});
        return { success: true, message: 'Monitoring stopped' };
      }
      return { success: false, message: 'No active monitoring to stop' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

