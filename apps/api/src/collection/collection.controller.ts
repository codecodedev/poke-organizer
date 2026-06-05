import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequestUser } from "../common/current-user.decorator";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { CollectionService } from "./collection.service";
import {
  AddCollectionItemDto,
  CollectionFolderQueryDto,
  CreateCollectionBidDto,
  CreateCollectionCartOfferDto,
  CreateCollectionFolderDto,
  DecideCollectionCartOfferDto,
  ListCollectionQueryDto,
  UpdateCollectionFolderDto,
  UpdateCollectionItemDto,
  UpdateCollectionSharingDto,
  UpdateCollectionStoreDto,
  UpdateFolderItemSaleDto
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

  @Patch("folders/:id/sharing")
  updateFolderSharing(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateCollectionSharingDto) {
    return this.collection.updateFolderSharing(user.id, id, dto);
  }

  @Patch("folders/:id/store")
  updateFolderStore(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateCollectionStoreDto) {
    return this.collection.updateFolderStore(user.id, id, dto);
  }

  @Patch("folders/:id/items/:folderItemId/sale")
  updateFolderItemSale(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Param("folderItemId") folderItemId: string,
    @Body() dto: UpdateFolderItemSaleDto
  ) {
    return this.collection.updateFolderItemSale(user.id, id, folderItemId, dto);
  }

  @Post("folders/:id/items/:folderItemId/finish-auction")
  finishAuction(@CurrentUser() user: RequestUser, @Param("id") id: string, @Param("folderItemId") folderItemId: string) {
    return this.collection.finishAuction(user.id, id, folderItemId);
  }

  @Get("folders/:id/offers")
  listFolderOffers(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.collection.listFolderOffers(user.id, id);
  }

  @Patch("folders/:id/offers/:offerId")
  decideFolderOffer(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Param("offerId") offerId: string,
    @Body() dto: DecideCollectionCartOfferDto
  ) {
    return this.collection.decideCartOffer(user.id, id, offerId, dto);
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

@ApiTags("public-collections")
@Controller("public/collections")
export class PublicCollectionController {
  constructor(private readonly collection: CollectionService) {}

  @Get(":shareToken")
  getPublicCollection(@Param("shareToken") shareToken: string, @Query() query: CollectionFolderQueryDto) {
    return this.collection.getPublicFolder(shareToken, query);
  }

  @Post(":shareToken/items/:folderItemId/bids")
  @UseGuards(JwtAuthGuard)
  createBid(
    @CurrentUser() user: RequestUser,
    @Param("shareToken") shareToken: string,
    @Param("folderItemId") folderItemId: string,
    @Body() dto: CreateCollectionBidDto
  ) {
    return this.collection.createBid(user.id, shareToken, folderItemId, dto);
  }

  @Post(":shareToken/offers")
  @UseGuards(JwtAuthGuard)
  createCartOffer(
    @CurrentUser() user: RequestUser,
    @Param("shareToken") shareToken: string,
    @Body() dto: CreateCollectionCartOfferDto
  ) {
    return this.collection.createCartOffer(user.id, shareToken, dto);
  }
}
