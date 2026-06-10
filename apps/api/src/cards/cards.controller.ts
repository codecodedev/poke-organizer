import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CatalogService } from "./catalog.service";
import { SearchCardsDto } from "./dto";
import { OptionalJwtAuthGuard } from "../common/jwt-auth.guard";
import { CurrentUser, RequestUser } from "../common/current-user.decorator";

@ApiTags("cards")
@Controller("cards")
export class CardsController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("search")
  search(@Query() query: SearchCardsDto) {
    return this.catalog.search(query);
  }

  @Get("sets")
  @UseGuards(OptionalJwtAuthGuard)
  sets(@CurrentUser() user?: RequestUser) {
    return this.catalog.listSets(user?.id);
  }

  @Get("sets/:id")
  @UseGuards(OptionalJwtAuthGuard)
  findOneSet(@Param("id") id: string, @CurrentUser() user?: RequestUser) {
    return this.catalog.getSetDetails(id, user?.id);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.catalog.findOne(id);
  }
}
