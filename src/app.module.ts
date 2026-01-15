import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppBootstrapService } from './app-bootstrap.service';
import { ChromeModule } from './chrome/chrome.module';
import { CrashModule } from './crash/crash.module';
import { CsvModule } from './csv/csv.module';
import { ShutdownModule } from './shutdown/shutdown.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ChromeModule,
    CrashModule,
    CsvModule,
    ShutdownModule,
  ],
  controllers: [AppController],
  providers: [AppService, AppBootstrapService],
})
export class AppModule {}

