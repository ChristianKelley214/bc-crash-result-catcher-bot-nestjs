import { Module, forwardRef } from '@nestjs/common';
import { CrashResultCatcherService } from './crash-result-catcher.service';
import { CrashController } from './crash.controller';
import { CsvModule } from '../csv/csv.module';
import { ShutdownModule } from '../shutdown/shutdown.module';

@Module({
  imports: [CsvModule, forwardRef(() => ShutdownModule)],
  controllers: [CrashController],
  providers: [CrashResultCatcherService],
  exports: [CrashResultCatcherService],
})
export class CrashModule {}

