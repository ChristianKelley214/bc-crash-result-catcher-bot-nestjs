import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return `Hello CatchBot! on port ${process.env.DEBUG_PORT}`;
  }
}

