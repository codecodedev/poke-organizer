import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";
import { Transform } from "class-transformer";

export class ListNegotiationsQueryDto {
  @ApiPropertyOptional({ enum: ["sales", "purchases"] })
  @IsOptional()
  @IsEnum(["sales", "purchases"])
  tab?: "sales" | "purchases";

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  showArchived?: boolean;
}

export class CreateNegotiationMessageDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message!: string;
}

export class CounterNegotiationDto {
  @ApiProperty()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0.01)
  totalOffer!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}

export class RespondCounterNegotiationDto {
  @ApiProperty({ enum: ["accepted", "rejected"] })
  @IsEnum(["accepted", "rejected"])
  status!: "accepted" | "rejected";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}

export class DecideProposalNegotiationDto {
  @ApiProperty({ enum: ["accepted", "rejected"] })
  @IsEnum(["accepted", "rejected"])
  status!: "accepted" | "rejected";
}

export class UpdateNegotiationOrderStatusDto {
  @ApiProperty({ enum: ["delivered", "cancelled"] })
  @IsEnum(["delivered", "cancelled"])
  status!: "delivered" | "cancelled";
}
