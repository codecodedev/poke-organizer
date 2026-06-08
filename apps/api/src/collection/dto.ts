import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  CARD_CONDITIONS,
  CARD_LANGUAGES,
  CardCondition,
  CardLanguage,
  DEFAULT_CARD_VARIANT,
} from "@poke-organizer/shared";
import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
  ValidateNested,
} from "class-validator";

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isStore?: boolean;
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

export class UpdateCollectionStoreDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  isStore?: boolean;
}

export class UpdateFolderItemSaleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === null || value === "" ? null : Number(value)))
  @IsNumber()
  manualPrice?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  isSold?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === null || value === "" ? null : Number(value)))
  @IsNumber()
  soldPrice?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;
}

export class CreateCollectionCartOfferItemDto {
  @ApiProperty()
  @IsString()
  folderItemId!: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiProperty()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  amount!: number;
}

export class CreateCollectionCartOfferDto {
  @ApiProperty({ type: [CreateCollectionCartOfferItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCollectionCartOfferItemDto)
  items!: CreateCollectionCartOfferItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsNumber()
  totalOffer?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  isGlobalOffer?: boolean;
}

export class DecideCollectionCartOfferDto {
  @ApiProperty({ enum: ["accepted", "rejected"] })
  @IsIn(["accepted", "rejected"])
  status!: "accepted" | "rejected";
}

export class UndoFolderItemSaleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}

export class ClearCollectionDto {
  @ApiProperty()
  @IsString()
  password!: string;
}

export class AddFolderPermissionDto {
  @ApiProperty()
  @IsString()
  email!: string;
}

export const COLLECTION_FOLDER_SORTS = [
  "value-desc",
  "value-asc",
  "price-change-desc",
  "price-change-asc",
  "newest",
  "oldest",
] as const;
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
