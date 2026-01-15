import { Controller, Get, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppService } from './app.service';
import { AppBootstrapService } from './app-bootstrap.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly configService: ConfigService,
    private readonly bootstrapService: AppBootstrapService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('env-example')
  getEnvExample() {
    return {
      appName: this.configService.get<string>('APP_NAME', 'CatchBot'),
      nodeEnv: this.configService.get<string>('NODE_ENV', 'development'),
      port: this.configService.get<number>('PORT', 3000),
    };
  }

  @Post('start')
  async start() {
    try {
      await this.bootstrapService.start();
      return { success: true, message: 'Crash result monitoring started' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @Post('stop')
  stop() {
    try {
      this.bootstrapService.stop();
      return { success: true, message: 'Crash result monitoring stopped' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

