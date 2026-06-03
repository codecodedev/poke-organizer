import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class RecognitionCandidatesDto {
  @ApiProperty({ description: "Raw OCR text from card frame" })
  @IsString()
  text!: string;

  @ApiPropertyOptional({ description: "Name detected by the frontend crop" })
  @IsOptional()
  @IsString()
  nameHint?: string;

  @ApiPropertyOptional({ description: "Number detected by the frontend crop, for example 115/086" })
  @IsOptional()
  @IsString()
  numberHint?: string;
}
