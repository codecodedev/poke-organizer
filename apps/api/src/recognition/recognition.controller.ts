import { Body, Controller, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { RecognitionCandidatesDto } from "./dto";
import { RecognitionService } from "./recognition.service";

@ApiTags("recognition")
@Controller("recognition")
export class RecognitionController {
  constructor(private readonly recognition: RecognitionService) {}

  @Post("candidates")
  candidates(@Body() dto: RecognitionCandidatesDto) {
    return this.recognition.findCandidates(dto);
  }
}
