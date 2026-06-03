import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CardCondition, CardLanguage } from "@poke-organizer/shared";
import { PricingService } from "./pricing.service";

@ApiTags("prices")
@Controller("prices")
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Get(":cardId")
  getPrice(
    @Param("cardId") cardId: string,
    @Query("variant") variant?: string,
    @Query("language") language?: CardLanguage,
    @Query("condition") condition?: CardCondition
  ) {
    return this.pricing.getEstimate(cardId, { variant, language, condition });
  }
}
