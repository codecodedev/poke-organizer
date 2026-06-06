import { Controller, Get, Patch, Param, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { CurrentUser, RequestUser } from "../common/current-user.decorator";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("notifications")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("notifications")
export class NotificationController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  @Patch(":id/read")
  markAsRead(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId: user.id },
      data: { isRead: true },
    });
  }
}
