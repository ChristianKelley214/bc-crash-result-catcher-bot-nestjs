import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as puppeteer from 'puppeteer-core';
import { Browser, Page } from 'puppeteer-core';

export interface CrashResult {
  gameId: string;
  multiplier: string;
  raw: string;
}

@Injectable()
export class CrashResultCatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CrashResultCatcherService.name);
  private debugPort: number;
  private browser: Browser | null = null;
  private page: Page | null = null;

  constructor(private configService: ConfigService) {
    this.debugPort = parseInt(
      this.configService.get<string>('DEBUG_PORT') || '9225',
      10,
    );
  }

  async onModuleInit() {
    // Optionally connect on module init
    // await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  async connect(): Promise<boolean> {
    const browserURL = `http://localhost:${this.debugPort}`;
    
    try {
      this.browser = await puppeteer.connect({
        browserURL: browserURL,
        defaultViewport: null,
      });

      const pages = await this.browser.pages();
      this.page = pages.find((page) => {
        const url = page.url();
        return url.includes('bc.game') && url.includes('crash');
      });

      if (!this.page) {
        this.page = pages[0] || (await this.browser.newPage());
        this.logger.warn(
          '⚠ Warning: No bc.game crash page found, using first available page',
        );
      }

      this.logger.log('Connected to Chrome browser');
      return true;
    } catch (error) {
      this.logger.error(`Failed to connect to Chrome: ${error.message}`);
      throw error;
    }
  }

  async waitForCrashBanner(timeout = 10000): Promise<boolean> {
    if (!this.page) {
      throw new Error('Not connected to Chrome. Call connect() first.');
    }

    await this.page.waitForSelector('#crash-banner', {
      visible: true,
      timeout,
    });
    return true;
  }

  async getLastCrashResult(): Promise<CrashResult> {
    if (!this.page) {
      throw new Error('Not connected to Chrome. Call connect() first.');
    }

    await this.waitForCrashBanner();

    const lastResult = await this.page.evaluate(() => {
      const crashBanner = document.querySelector('#crash-banner');
      if (!crashBanner) {
        return null;
      }

      const resultItems = crashBanner.querySelectorAll(
        'div.flex.items-center.justify-center.gap-1.px-2.h-full.cursor-pointer',
      );

      if (resultItems.length === 0) {
        return null;
      }

      const lastItem = resultItems[resultItems.length - 1];
      const gameIdSpan = lastItem.querySelector(
        'span.text-tertiary.font-semibold',
      );
      const gameId = gameIdSpan ? gameIdSpan.textContent?.trim() || null : null;
      const multiplierSpan = lastItem.querySelector('span.font-extrabold');
      const multiplier = multiplierSpan
        ? multiplierSpan.textContent?.trim() || null
        : null;

      return {
        gameId,
        multiplier,
        raw: lastItem.textContent?.trim() || '',
      };
    });

    if (!lastResult || !lastResult.gameId || !lastResult.multiplier) {
      throw new Error('Could not extract crash result from history bar');
    }

    return lastResult;
  }

  async getAllCrashResults(): Promise<CrashResult[]> {
    if (!this.page) {
      throw new Error('Not connected to Chrome. Call connect() first.');
    }

    await this.waitForCrashBanner();

    const results = await this.page.evaluate(() => {
      const crashBanner = document.querySelector('#crash-banner');
      if (!crashBanner) {
        return [];
      }

      const resultItems = crashBanner.querySelectorAll(
        'div.flex.items-center.justify-center.gap-1.px-2.h-full.cursor-pointer',
      );
      const allResults: CrashResult[] = [];

      resultItems.forEach((item) => {
        const gameIdSpan = item.querySelector('span.text-tertiary.font-semibold');
        const multiplierSpan = item.querySelector('span.font-extrabold');

        const gameId = gameIdSpan
          ? gameIdSpan.textContent?.trim() || null
          : null;
        const multiplier = multiplierSpan
          ? multiplierSpan.textContent?.trim() || null
          : null;

        if (gameId && multiplier) {
          allResults.push({
            gameId,
            multiplier,
            raw: item.textContent?.trim() || '',
          });
        }
      });

      return allResults;
    });

    return results;
  }

  async monitorCrashResults(
    callback: (result: CrashResult) => void,
    interval?: number,
  ): Promise<() => void> {
    const checkInterval =
      interval ||
      parseInt(
        this.configService.get<string>('MONITOR_INTERVAL') || '500',
        10,
      );
    let lastGameId: string | null = null;

    const checkForNewResult = async () => {
      try {
        const result = await this.getLastCrashResult();
        if (result && result.gameId !== lastGameId) {
          lastGameId = result.gameId;
          callback(result);
        }
      } catch (error) {
        // Ignore monitoring errors
        this.logger.debug(`Monitoring error: ${error.message}`);
      }
    };

    await checkForNewResult();

    const monitorInterval = setInterval(async () => {
      await checkForNewResult();
    }, checkInterval);

    return () => {
      clearInterval(monitorInterval);
    };
  }

  async getAccountBalance(): Promise<number> {
    if (!this.page) {
      throw new Error('Not connected to Chrome. Call connect() first.');
    }

    const balance = await this.page.evaluate(() => {
      const balanceDiv = document.querySelector(
        'div.flex.w-0.flex-auto.items-center.truncate.font-extrabold',
      );

      if (balanceDiv) {
        const text = balanceDiv.textContent || '';
        const balanceStr = text.replace(/[$,]/g, '').trim();
        const balanceNum = parseFloat(balanceStr);
        if (!isNaN(balanceNum)) {
          return balanceNum;
        }
      }

      const usdtImages = Array.from(
        document.querySelectorAll('img[src*="USDT"], img[src*="coin"]'),
      );
      for (const img of usdtImages) {
        const container = img.closest('div.flex.items-center');
        if (container) {
          const balanceDiv = container.querySelector('div.font-extrabold');
          if (balanceDiv) {
            const text = balanceDiv.textContent || '';
            if (text.includes('$') || /^[\d,]+\.?\d*$/.test(text.trim())) {
              const balanceStr = text.replace(/[$,]/g, '').trim();
              const balanceNum = parseFloat(balanceStr);
              if (!isNaN(balanceNum)) {
                return balanceNum;
              }
            }
          }
        }
      }

      const allBalanceElements = document.querySelectorAll('div.font-extrabold');
      for (const element of allBalanceElements) {
        const text = element.textContent || '';
        if (/^\$?[\d,]+\.?\d*$/.test(text.trim())) {
          const balanceStr = text.replace(/[$,]/g, '').trim();
          const balanceNum = parseFloat(balanceStr);
          if (!isNaN(balanceNum)) {
            return balanceNum;
          }
        }
      }

      return null;
    });

    if (balance === null || isNaN(balance)) {
      throw new Error('Could not extract account balance from page');
    }

    return balance;
  }

  async disconnect(): Promise<void> {
    if (this.browser) {
      await this.browser.disconnect();
      this.browser = null;
      this.page = null;
      this.logger.log('Disconnected from Chrome browser');
    }
  }
}

