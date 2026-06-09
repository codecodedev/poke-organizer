import "reflect-metadata";
import { join } from "node:path";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true }),
  );

  await app.register(multipart as any, {
    limits: {
      fileSize: 5 * 1024 * 1024 // 5MB
    }
  });

  await app.register(fastifyStatic as any, {
    root: join(__dirname, "..", "public"),
    prefix: "/public/",
  });

  const config = app.get(ConfigService);
  const webOrigins = (config.get<string>("WEB_ORIGIN") ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: webOrigins,
    credentials: true
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true
    })
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Coleciona cards API")
    .setDescription("API para organizar colecoes de cartas Pokemon.")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, swaggerConfig));

  await app.listen(config.get<number>("API_PORT") ?? 3333, config.get<string>("API_HOST") ?? "0.0.0.0");
}

void bootstrap();
