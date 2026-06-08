import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { CardsModule } from "./cards/cards.module";
import { CollectionModule } from "./collection/collection.module";
import { DecksModule } from "./decks/decks.module";
import { HealthController } from "./health.controller";
import { PricingModule } from "./pricing/pricing.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RecognitionModule } from "./recognition/recognition.module";
import { NotificationModule } from "./notification/notification.module";
import { AuctionModule } from "./auction/auction.module";
import { UserModule } from "./user/user.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    CardsModule,
    CollectionModule,
    DecksModule,
    PricingModule,
    RecognitionModule,
    NotificationModule,
    AuctionModule,
    UserModule
  ],
  controllers: [HealthController]
})
export class AppModule {}
