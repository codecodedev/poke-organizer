import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CARD_CONDITIONS, CARD_LANGUAGES, CardCondition, CardLanguage, DEFAULT_CARD_VARIANT } from "@poke-organizer/shared";
import { Transform } from "class-transformer";
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Min, Max } from "class-validator";

export class AddCollectionItemDto {
  @ApiProperty({ description: "Local card id or external provider id" })
  @IsString()
  cardId!: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({ enum: CARD_CONDITIONS, default: "NM" })
  @IsOptional()
  @IsIn(CARD_CONDITIONS)
  condition?: CardCondition;

  @ApiPropertyOptional({ default: DEFAULT_CARD_VARIANT })
  @IsOptional()
  @IsString()
  variant?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  foil?: boolean;

  @ApiPropertyOptional({ enum: CARD_LANGUAGES, default: "unknown" })
  @IsOptional()
  @IsIn(CARD_LANGUAGES)
  language?: CardLanguage;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

}

export class UpdateCollectionItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({ enum: CARD_CONDITIONS })
  @IsOptional()
  @IsIn(CARD_CONDITIONS)
  condition?: CardCondition;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  variant?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  foil?: boolean;

  @ApiPropertyOptional({ enum: CARD_LANGUAGES })
  @IsOptional()
  @IsIn(CARD_LANGUAGES)
  language?: CardLanguage;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string | null;

}

export class ListCollectionQueryDto {
  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class CreateCollectionFolderDto {
  @ApiProperty()
  @IsString()
  name!: string;
}

export class UpdateCollectionFolderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  itemIds?: string[];
}

export class UpdateCollectionSharingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  ensureToken?: boolean;
}

export const COLLECTION_FOLDER_SORTS = ["value-desc", "value-asc", "newest", "oldest"] as const;
export type CollectionFolderSort = (typeof COLLECTION_FOLDER_SORTS)[number];

export class CollectionFolderQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rarity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  variant?: string;

  @ApiPropertyOptional({ enum: COLLECTION_FOLDER_SORTS })
  @IsOptional()
  @IsIn(COLLECTION_FOLDER_SORTS)
  sort?: CollectionFolderSort;
}
