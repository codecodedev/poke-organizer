import { ApiProperty } from "@nestjs/swagger";
import { Equals, IsBoolean, IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class RegisterDto {
  @ApiProperty({ example: "ash@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "Ash Ketchum", required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: "SP", required: false })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({ example: "São Paulo", required: false })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  @Equals(true)
  acceptTerms!: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  @Equals(true)
  acceptPrivacy!: boolean;
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
