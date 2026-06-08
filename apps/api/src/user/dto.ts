import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString } from "class-validator";

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  profileSlug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  profileBio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublicProfile?: boolean;
}
