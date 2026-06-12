import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { EmailModule } from "../email/email.module";
import { OrderModule } from "../order/order.module";
import { PrismaModule } from "../prisma/prisma.module";
import { NegotiationController } from "./negotiation.controller";
import { NegotiationGateway } from "./negotiation.gateway";
import { NegotiationRealtimeService } from "./negotiation-realtime.service";
import { NegotiationService } from "./negotiation.service";

@Module({
  imports: [PrismaModule, EmailModule, OrderModule, JwtModule.register({})],
  controllers: [NegotiationController],
  providers: [NegotiationService, NegotiationGateway, NegotiationRealtimeService],
  exports: [NegotiationService, NegotiationRealtimeService],
})
export class NegotiationModule {}
