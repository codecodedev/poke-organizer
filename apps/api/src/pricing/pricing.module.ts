import { Module } from "@nestjs/common";
import { CardsModule } from "../cards/cards.module";
import { BrazilianMarketProvider } from "./providers/brazilian-market.provider";
import { PricingController } from "./pricing.controller";
import { PricingService } from "./pricing.service";

@Module({
  imports: [CardsModule],
  controllers: [PricingController],
  providers: [PricingService, BrazilianMarketProvider],
  exports: [PricingService]
})
export class PricingModule {}
