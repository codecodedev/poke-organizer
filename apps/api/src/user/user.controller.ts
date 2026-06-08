import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequestUser } from "../common/current-user.decorator";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { UserService } from "./user.service";
import { UpdateProfileDto } from "./dto";

@ApiTags("users")
@Controller("users")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get("profile/:slug")
  getPublicProfile(@Param("slug") slug: string) {
    return this.userService.getPublicProfile(slug);
  }

  @Get("check-slug/:slug")
  checkSlug(@Param("slug") slug: string) {
    return this.userService.checkSlug(slug);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch("profile")
  updateProfile(@CurrentUser() user: RequestUser, @Body() dto: UpdateProfileDto) {
    return this.userService.updateProfile(user.id, dto);
  }
}
