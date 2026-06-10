import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CardsController } from "./cards.controller";
import { CatalogService } from "./catalog.service";

@Module({
  imports: [AuthModule],
  controllers: [CardsController],
  providers: [CatalogService],
  exports: [CatalogService]
})
export class CardsModule {}
