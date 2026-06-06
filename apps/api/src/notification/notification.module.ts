import { Module } from "@nestjs/common";
import { NotificationController } from "./notification.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { JwtModule } from "@nestjs/jwt";

@Module({
  imports: [PrismaModule, JwtModule.register({})],
  controllers: [NotificationController],
})
export class NotificationModule {}
