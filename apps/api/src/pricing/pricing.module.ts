import { Module } from "@nestjs/common";
import { BrazilianMarketProvider } from "./providers/brazilian-market.provider";
import { PricingController } from "./pricing.controller";
import { PricingService } from "./pricing.service";

@Module({
  controllers: [PricingController],
  providers: [PricingService, BrazilianMarketProvider],
  exports: [PricingService]
})
export class PricingModule {}
