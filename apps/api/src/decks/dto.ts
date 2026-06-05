import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested
} from "class-validator";
import { DECK_FORMATS, DECK_GENERATION_MODES, type DeckFormat, type DeckGenerationMode } from "@poke-organizer/shared";

export class DeckCardInputDto {
  @IsString()
  cardId!: string;

  @IsInt()
  @Min(1)
  @Max(60)
  quantity!: number;

  @IsOptional()
  @IsIn(["owned", "missing"])
  source?: "owned" | "missing";
}

export class CreateDeckDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsIn(DECK_FORMATS)
  format?: DeckFormat;

  @IsOptional()
  @IsIn(DECK_GENERATION_MODES)
  generationMode?: DeckGenerationMode;

  @IsOptional()
  @IsString()
  archetypeId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(80)
  @ValidateNested({ each: true })
  @Type(() => DeckCardInputDto)
  cards?: DeckCardInputDto[];
}

export class UpdateDeckDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(DECK_FORMATS)
  format?: DeckFormat;

  @IsOptional()
  @IsIn(DECK_GENERATION_MODES)
  generationMode?: DeckGenerationMode;

  @IsOptional()
  @IsString()
  archetypeId?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(80)
  @ValidateNested({ each: true })
  @Type(() => DeckCardInputDto)
  cards?: DeckCardInputDto[];
}

export class GenerateBestDeckDto {
  @IsOptional()
  @IsIn(DECK_FORMATS)
  format?: DeckFormat;

  @IsOptional()
  @IsIn(DECK_GENERATION_MODES)
  mode?: DeckGenerationMode;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredTypes?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  maxSuggestions?: number;
}

export class MetagameSyncDto {
  @IsOptional()
  @IsBoolean()
  includeLimitless?: boolean;
}
