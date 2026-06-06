import { Module } from "@nestjs/common";
import { NotificationController } from "./notification.controller";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [NotificationController],
})
export class NotificationModule {}
