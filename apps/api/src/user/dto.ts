import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from "class-validator";
import { BrazilianState } from "../auth/dto";

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: "Nome não pode ser vazio" })
  @MinLength(3, { message: "Nome deve ter pelo menos 3 caracteres" })
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
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean({ message: 'isPublicProfile deve ser um booleano (verdadeiro/falso)' })
  isPublicProfile?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  whatsapp?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(BrazilianState, { message: "Estado (UF) inválido" })
  state?: BrazilianState;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: "Cidade não pode ser vazia" })
  city?: string;
}
