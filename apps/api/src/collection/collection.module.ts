import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CardsModule } from "../cards/cards.module";
import { PricingModule } from "../pricing/pricing.module";
import { CollectionController } from "./collection.controller";
import { CollectionService } from "./collection.service";

@Module({
  imports: [AuthModule, CardsModule, PricingModule],
  controllers: [CollectionController],
  providers: [CollectionService]
})
export class CollectionModule {}
