import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class SearchCardsDto {
  @ApiPropertyOptional({ example: "Charizard" })
  @IsOptional()
  @IsString()
  query?: string;

  @ApiPropertyOptional({ example: "4/102" })
  @IsOptional()
  @IsString()
  number?: string;

  @ApiPropertyOptional({ example: "base1" })
  @IsOptional()
  @IsString()
  set?: string;

  @ApiPropertyOptional({ example: "en" })
  @IsOptional()
  @IsString()
  language?: string;
}
