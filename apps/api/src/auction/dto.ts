import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateAuctionDto {
  @ApiProperty()
  @IsString()
  collectionItemId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  minBidBrl!: number;

  @ApiProperty()
  @IsDateString()
  endsAt!: string;
}

export class PlaceAuctionBidDto {
  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  amountBrl!: number;
}
