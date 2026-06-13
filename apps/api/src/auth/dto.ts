import { ApiProperty } from "@nestjs/swagger";
import { Equals, IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsString, MinLength } from "class-validator";

export enum BrazilianState {
  AC = "AC", AL = "AL", AP = "AP", AM = "AM", BA = "BA", CE = "CE", DF = "DF", ES = "ES", GO = "GO",
  MA = "MA", MT = "MT", MS = "MS", MG = "MG", PA = "PA", PB = "PB", PR = "PR", PE = "PE", PI = "PI",
  RJ = "RJ", RN = "RN", RS = "RS", RO = "RO", RR = "RR", SC = "SC", SP = "SP", SE = "SE", TO = "TO"
}

export class RegisterDto {
  @ApiProperty({ example: "ash@example.com" })
  @IsEmail({}, { message: "E-mail inválido" })
  email!: string;

  @ApiProperty({ example: "Ash Ketchum" })
  @IsString()
  @IsNotEmpty({ message: "Nome é obrigatório" })
  @MinLength(3, { message: "Nome deve ter pelo menos 3 caracteres" })
  name!: string;

  @ApiProperty({ example: "SP" })
  @IsEnum(BrazilianState, { message: "Estado (UF) inválido" })
  state!: BrazilianState;

  @ApiProperty({ example: "São Paulo" })
  @IsString()
  @IsNotEmpty({ message: "Cidade é obrigatória" })
  city!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8, { message: "Senha deve ter pelo menos 8 caracteres" })
  password!: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  @Equals(true, { message: "Você deve aceitar os Termos de Uso" })
  acceptTerms!: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  @Equals(true, { message: "Você deve aceitar a Política de Privacidade" })
  acceptPrivacy!: boolean;
}

export class RequestEmailConfirmationDto {
  @ApiProperty({ example: "ash@example.com" })
  @IsEmail({}, { message: "E-mail inválido" })
  email!: string;
}

export class LoginDto {
  @ApiProperty({ example: "ash@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  password!: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  refreshToken!: string;
}

export class RequestPasswordResetDto {
  @ApiProperty({ example: "ash@example.com" })
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  token!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;
}

export class ConfirmEmailDto {
  @ApiProperty()
  @IsString()
  token!: string;
}
