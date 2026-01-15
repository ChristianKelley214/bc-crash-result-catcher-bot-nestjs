# CatchBot

A NestJS application with environment variable configuration.

## Installation

```bash
npm install
```

## Environment Variables

Copy the `.env.example` file to `.env` and configure your environment variables:

```bash
cp .env.example .env
```

Edit `.env` file with your configuration values.

## Running the app

```bash
# development
npm run start:dev

# production mode
npm run start:prod
```

## Using Environment Variables

The application uses `@nestjs/config` to manage environment variables. The `ConfigModule` is configured globally, so you can inject `ConfigService` anywhere in your application.

### Example Usage

```typescript
import { ConfigService } from '@nestjs/config';

constructor(private configService: ConfigService) {
  const appName = this.configService.get<string>('APP_NAME');
  const port = this.configService.get<number>('PORT');
}
```

## Test

```bash
# unit tests
npm run test

# e2e tests
npm run test:e2e

# test coverage
npm run test:cov
```

## License

Private

