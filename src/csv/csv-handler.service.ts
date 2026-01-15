import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { CrashResult } from '../crash/crash-result-catcher.service';

@Injectable()
export class CsvHandlerService {
  private readonly logger = new Logger(CsvHandlerService.name);
  private resultsDir: string;
  private currentDate: string | null = null;
  private csvFilePath: string | null = null;

  constructor(private configService: ConfigService) {
    this.resultsDir =
      this.configService.get<string>('CSV_RESULTS_DIR') ||
      path.join(process.cwd(), 'results');
    this.initialize();
  }

  private getDateString(): string {
    const now = new Date();
    const month = now.getMonth() + 1; // 1-12
    const day = now.getDate(); // 1-31
    return `${month}-${day}`;
  }

  private getCsvFilePath(): string {
    const dateString = this.getDateString();
    return path.join(this.resultsDir, `${dateString}.csv`);
  }

  private initialize(): void {
    // Ensure results directory exists
    if (!fs.existsSync(this.resultsDir)) {
      fs.mkdirSync(this.resultsDir, { recursive: true });
      this.logger.log(`Created results directory: ${this.resultsDir}`);
    }

    // Set current date and CSV file path
    this.currentDate = this.getDateString();
    this.csvFilePath = this.getCsvFilePath();

    // Initialize CSV file with headers if it doesn't exist or is empty
    this.initializeCSV();
  }

  private initializeCSV(): void {
    if (!this.csvFilePath) {
      return;
    }

    const headers = 'gameId,multiplier,timestamp\n';

    if (!fs.existsSync(this.csvFilePath)) {
      fs.writeFileSync(this.csvFilePath, headers, 'utf8');
      this.logger.log(
        `✓ Created ${path.basename(this.csvFilePath)} with headers`,
      );
    } else {
      const content = fs.readFileSync(this.csvFilePath, 'utf8');
      if (!content.trim() || !content.includes('gameId')) {
        fs.writeFileSync(this.csvFilePath, headers, 'utf8');
        this.logger.log(
          `✓ Initialized ${path.basename(this.csvFilePath)} with headers`,
        );
      }
    }
  }

  private checkAndSwitchFile(): void {
    const newDate = this.getDateString();
    if (newDate !== this.currentDate) {
      // Date changed, switch to new file
      this.currentDate = newDate;
      this.csvFilePath = this.getCsvFilePath();
      this.initializeCSV();
      this.logger.log(
        `✓ Switched to new date file: ${path.basename(this.csvFilePath)}`,
      );
    }
  }

  private formatTimestamp(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${month}:${day}T${hours}:${minutes}:${seconds}`;
  }

  private formatMultiplier(multiplier: string): string {
    // Pad multiplier to 7 characters with leading spaces
    return String(multiplier).padStart(7, ' ');
  }

  save(result: CrashResult): void {
    // Check if date changed and switch to new file if needed
    this.checkAndSwitchFile();

    if (!this.csvFilePath) {
      throw new Error('CSV file path is not initialized');
    }

    const timestamp = this.formatTimestamp();
    const multiplier = this.formatMultiplier(result.multiplier);
    const row = `${result.gameId},${multiplier.slice(0, -1)},  ${timestamp}\n`;

    fs.appendFileSync(this.csvFilePath, row, 'utf8');
    this.logger.log(
      `✓ Saved: Game ${result.gameId} - Multiplier: ${multiplier}`,
    );
  }

  getCurrentFilePath(): string | null {
    return this.csvFilePath;
  }

  getResultsDir(): string {
    return this.resultsDir;
  }
}

