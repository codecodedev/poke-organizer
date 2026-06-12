import { Module } from "@nestjs/common";
import { OrderController } from "./order.controller";
import { OrderService } from "./order.service";
import { PrismaModule } from "../prisma/prisma.module";
import { EmailModule } from "../email/email.module";
import { JwtModule } from "@nestjs/jwt";
import { OrderGateway } from "./order.gateway";
import { OrderRealtimeService } from "./order-realtime.service";

@Module({
  imports: [PrismaModule, EmailModule, JwtModule.register({})],
  controllers: [OrderController],
  providers: [OrderService, OrderGateway, OrderRealtimeService],
  exports: [OrderService],
})
export class OrderModule {}
