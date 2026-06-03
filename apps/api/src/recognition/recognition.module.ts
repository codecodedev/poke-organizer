import { Module } from "@nestjs/common";
import { CardsModule } from "../cards/cards.module";
import { RecognitionController } from "./recognition.controller";
import { RecognitionService } from "./recognition.service";

@Module({
  imports: [CardsModule],
  controllers: [RecognitionController],
  providers: [RecognitionService]
})
export class RecognitionModule {}
