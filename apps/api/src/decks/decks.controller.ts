import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequestUser } from "../common/current-user.decorator";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { CreateDeckDto, GenerateBestDeckDto, MetagameSyncDto, UpdateDeckDto } from "./dto";
import { DecksService } from "./decks.service";

@ApiTags("decks")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class DecksController {
  constructor(private readonly decks: DecksService) {}

  @Get("decks")
  list(@CurrentUser() user: RequestUser) {
    return this.decks.list(user.id);
  }

  @Post("decks")
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateDeckDto) {
    return this.decks.create(user.id, dto);
  }

  @Post("decks/generate-best")
  generateBest(@CurrentUser() user: RequestUser, @Body() dto: GenerateBestDeckDto) {
    return this.decks.generateBest(user.id, dto);
  }

  @Get("decks/:id")
  get(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.decks.get(user.id, id);
  }

  @Patch("decks/:id")
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateDeckDto) {
    return this.decks.update(user.id, id, dto);
  }

  @Delete("decks/:id")
  remove(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.decks.remove(user.id, id);
  }

  @Post("decks/:id/validate")
  validate(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.decks.validate(user.id, id);
  }

  @Get("deck-archetypes")
  listArchetypes() {
    return this.decks.listArchetypes();
  }

  @Post("metagame/sync")
  syncMetagame(@Body() dto: MetagameSyncDto) {
    return this.decks.syncMetagame(dto);
  }
}
