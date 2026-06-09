import { ApiProperty } from "@nestjs/swagger";
import { IsEnum } from "class-validator";

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: ["delivered", "cancelled"] })
  @IsEnum(["delivered", "cancelled"])
  status: "delivered" | "cancelled";
}
