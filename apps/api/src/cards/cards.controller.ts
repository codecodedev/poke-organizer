import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CatalogService } from "./catalog.service";
import { SearchCardsDto } from "./dto";

@ApiTags("cards")
@Controller("cards")
export class CardsController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("search")
  search(@Query() query: SearchCardsDto) {
    return this.catalog.search(query);
  }

  @Get("sets")
  sets() {
    return this.catalog.listSets();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.catalog.findOne(id);
  }
}
