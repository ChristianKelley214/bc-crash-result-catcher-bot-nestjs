import { Module } from '@nestjs/common';
import { ChromeManagerService } from './chrome-manager.service';

@Module({
  providers: [ChromeManagerService],
  exports: [ChromeManagerService],
})
export class ChromeModule {}

