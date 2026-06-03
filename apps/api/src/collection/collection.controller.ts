import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequestUser } from "../common/current-user.decorator";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { CollectionService } from "./collection.service";
import {
  AddCollectionItemDto,
  CollectionFolderQueryDto,
  CreateCollectionFolderDto,
  ListCollectionQueryDto,
  UpdateCollectionFolderDto,
  UpdateCollectionItemDto
} from "./dto";

@ApiTags("collection")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("collection")
export class CollectionController {
  constructor(private readonly collection: CollectionService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Query() query: ListCollectionQueryDto) {
    return this.collection.list(user.id, query.limit);
  }

  @Post()
  add(@CurrentUser() user: RequestUser, @Body() dto: AddCollectionItemDto) {
    return this.collection.add(user.id, dto);
  }

  @Get("folders")
  listFolders(@CurrentUser() user: RequestUser) {
    return this.collection.listFolders(user.id);
  }

  @Post("folders")
  createFolder(@CurrentUser() user: RequestUser, @Body() dto: CreateCollectionFolderDto) {
    return this.collection.createFolder(user.id, dto);
  }

  @Get("folders/:id")
  getFolder(@CurrentUser() user: RequestUser, @Param("id") id: string, @Query() query: CollectionFolderQueryDto) {
    return this.collection.getFolder(user.id, id, query);
  }

  @Patch("folders/:id")
  updateFolder(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateCollectionFolderDto) {
    return this.collection.updateFolder(user.id, id, dto);
  }

  @Delete("folders/:id")
  removeFolder(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.collection.removeFolder(user.id, id);
  }

  @Patch(":id")
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateCollectionItemDto) {
    return this.collection.update(user.id, id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.collection.remove(user.id, id);
  }
}
