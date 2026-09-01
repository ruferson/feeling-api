import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Set a global API route prefix
  app.setGlobalPrefix('api');

  // Configure strict global validation pipes for DTO sanitization
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Enable CORS with customized headers and methods
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type, Accept, Authorization',
  });

  // Swagger OpenAPI documentation configuration
  const config = new DocumentBuilder()
    .setTitle('FeelinG API')
    .setDescription(
      'The FeelinG Backend API documentation and endpoints reference',
    )
    .setVersion('1.0')
    .addBearerAuth() // Enable JWT Bearer token authentication button in the Swagger UI
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Swagger UI route endpoint mapping
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  logger.log(`Application is running on: http://localhost:${port}/api`);
  logger.log(`Swagger documentation: http://localhost:${port}/api/docs`);
}

void bootstrap();
