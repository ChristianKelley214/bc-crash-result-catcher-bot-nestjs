import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { AppBootstrapService } from './app-bootstrap.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  let port = configService.get<number>('PORT') || 8001;
  
  // Try to listen on the port, or find an available port
  try {
    await app.listen(port);
    console.log(`Application is running on: http://localhost:${port}`);
  } catch (error) {
    if (error.code === 'EADDRINUSE') {
      console.error(`\n✗ Port ${port} is already in use.`);
      console.error('Please either:');
      console.error(`  1. Stop the process using port ${port}`);
      console.error('  2. Set a different PORT in your .env file');
      console.error('  3. Kill the process: netstat -ano | findstr :' + port);
      process.exit(1);
    }
    throw error;
  }
  
  // Start the crash result monitoring system
  try {
    const bootstrapService = app.get(AppBootstrapService);
    await bootstrapService.start();
  } catch (error) {
    console.error('Failed to start crash result monitoring:', error.message);
    process.exit(1);
  }
}

bootstrap();

