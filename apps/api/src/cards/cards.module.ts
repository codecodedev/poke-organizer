import { Module } from "@nestjs/common";
import { CardsController } from "./cards.controller";
import { CatalogService } from "./catalog.service";

@Module({
  controllers: [CardsController],
  providers: [CatalogService],
  exports: [CatalogService]
})
export class CardsModule {}
