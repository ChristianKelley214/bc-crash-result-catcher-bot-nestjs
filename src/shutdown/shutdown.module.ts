import { Module, forwardRef } from '@nestjs/common';
import { ShutdownHandlerService } from './shutdown-handler.service';
import { CrashModule } from '../crash/crash.module';
import { ChromeModule } from '../chrome/chrome.module';

@Module({
  imports: [forwardRef(() => CrashModule), ChromeModule],
  providers: [ShutdownHandlerService],
  exports: [ShutdownHandlerService],
})
export class ShutdownModule {}

