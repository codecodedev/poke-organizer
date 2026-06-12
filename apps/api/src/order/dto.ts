import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsString, MaxLength, MinLength } from "class-validator";

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: ["delivered", "cancelled"] })
  @IsEnum(["delivered", "cancelled"])
  status: "delivered" | "cancelled";
}

export class CreateOrderMessageDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message!: string;
}
