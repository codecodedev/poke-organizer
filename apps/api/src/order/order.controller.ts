import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { CurrentUser } from "../common/current-user.decorator";
import { OrderService } from "./order.service";
import { UpdateOrderStatusDto } from "./dto";

@ApiTags("Orders")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("orders")
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get("sales")
  async listMySales(@CurrentUser("id") userId: string) {
    return this.orderService.listMySales(userId);
  }

  @Get("purchases")
  async listMyPurchases(@CurrentUser("id") userId: string) {
    return this.orderService.listMyPurchases(userId);
  }

  @Post(":id/status")
  async updateStatus(
    @CurrentUser("id") userId: string,
    @Param("id") id: string,
    @Body() dto: UpdateOrderStatusDto
  ) {
    return this.orderService.updateStatus(userId, id, dto.status);
  }
}
