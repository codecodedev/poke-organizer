import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import { FastifyReply, FastifyRequest } from "fastify";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequestUser } from "../common/current-user.decorator";
import { JwtAuthGuard, OptionalJwtAuthGuard } from "../common/jwt-auth.guard";
import { CollectionService } from "./collection.service";
import {
  AddCollectionItemDto,
  ClearCollectionDto,
  CollectionFolderQueryDto,
  CreateCollectionCartOfferDto,
  CreateCollectionFolderDto,
  DecideCollectionCartOfferDto,
  ListCollectionQueryDto,
  UpdateCollectionFolderDto,
  UpdateCollectionItemDto,
  UpdateCollectionSharingDto,
  UpdateCollectionStoreDto,
  UpdateFolderItemSaleDto,
  AddFolderPermissionDto,
  UndoFolderItemSaleDto,
  } from "./dto";

@ApiTags("Coleções")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("collection")
export class CollectionController {
  constructor(private readonly collection: CollectionService) {}

  @Get("summary")
  @ApiOperation({ summary: "Resumo da home", description: "Retorna estatísticas, coleções em alta e propostas recentes para o usuário logado." })
  getSummary(@CurrentUser() user: RequestUser) {
    return this.collection.getHomeSummary(user.id);
  }

  @Delete("clear")
  @ApiOperation({ summary: "Limpar inventário", description: "Remove todas as cartas do inventário do usuário." })
  clear(@CurrentUser() user: RequestUser, @Body() dto: ClearCollectionDto) {
    return this.collection.clearCollection(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: "Listar cartas", description: "Lista todas as cartas do inventário global do usuário." })
  list(@CurrentUser() user: RequestUser, @Query() query: ListCollectionQueryDto) {
    return this.collection.list(user.id, query.limit);
  }

  @Post()
  @ApiOperation({ summary: "Adicionar carta", description: "Adiciona uma nova carta ao inventário do usuário." })
  add(@CurrentUser() user: RequestUser, @Body() dto: AddCollectionItemDto) {
    return this.collection.add(user.id, dto);
  }

  @Get("folders")
  @ApiOperation({ summary: "Listar pastas", description: "Retorna a lista de pastas/coleções do usuário." })
  listFolders(@CurrentUser() user: RequestUser) {
    return this.collection.listFolders(user.id);
  }

  @Post("folders")
  @ApiOperation({ summary: "Criar pasta", description: "Cria uma nova pasta ou loja pública." })
  createFolder(@CurrentUser() user: RequestUser, @Body() dto: CreateCollectionFolderDto) {
    return this.collection.createFolder(user.id, dto);
  }

  @Get("my-proposals")
  listMyProposals(@CurrentUser() user: RequestUser) {
    return this.collection.listMyProposals(user.id);
  }

  @Get("received-proposals")
  listMyReceivedProposals(@CurrentUser() user: RequestUser) {
    return this.collection.listMyReceivedProposals(user.id);
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

  @Post("folders/:id/banner")
  async uploadBanner(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Req() req: FastifyRequest
  ) {
    const data = await req.file();
    if (!data) throw new BadRequestException("No file uploaded");
    return this.collection.uploadBanner(user.id, id, data);
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

  @Post("folders/:id/items/:folderItemId/undo-sale")
  undoSale(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Param("folderItemId") folderItemId: string,
    @Body() dto: UndoFolderItemSaleDto
  ) {
    return this.collection.undoFolderItemSale(user.id, id, folderItemId, dto);
  }

  @Delete("folders/:id/items/:folderItemId")
  removeItem(@CurrentUser() user: RequestUser, @Param("id") id: string, @Param("folderItemId") folderItemId: string) {
    return this.collection.removeItemFromFolder(user.id, id, folderItemId);
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

  @Get("folders/:id/permissions")
  getFolderPermissions(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.collection.getFolderPermissions(user.id, id);
  }

  @Post("folders/:id/permissions")
  addFolderPermission(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: AddFolderPermissionDto
  ) {
    return this.collection.addFolderPermission(user.id, id, dto);
  }

  @Delete("folders/:id/permissions/:permissionId")
  removeFolderPermission(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Param("permissionId") permissionId: string
  ) {
    return this.collection.removeFolderPermission(user.id, id, permissionId);
  }

  @Delete("folders/:id")
  removeFolder(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.collection.removeFolder(user.id, id);
  }

  @Get("market-search")
  @UseGuards(OptionalJwtAuthGuard)
  searchMarket(@Query("query") query: string) {
    return this.collection.searchMarket(query);
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
  @UseGuards(OptionalJwtAuthGuard)
  getPublicCollection(
    @Param("shareToken") shareToken: string,
    @Query() query: CollectionFolderQueryDto & { sid?: string },
    @Req() req: FastifyRequest,
    @CurrentUser() user?: RequestUser,
  ) {
    const ip = (req.headers["x-forwarded-for"] as string) || req.ip;
    const userAgent = (req.headers["user-agent"] as string) || "unknown";

    return this.collection.getPublicFolder(shareToken, query, {
      ip,
      userAgent,
      userId: user?.id,
      sid: query.sid,
    });
  }

  @Get(":shareToken/share")
  async getShareHtml(
    @Param("shareToken") shareToken: string,
    @Res() res: FastifyReply,
  ) {
    const html = await this.collection.getShareHtml(shareToken);
    res
      .header("Cache-Control", "public, max-age=3600")
      .type("text/html; charset=utf-8")
      .send(html);
  }

  @Get(":shareToken/preview-image")
  async getPreviewImage(
    @Param("shareToken") shareToken: string,
    @Res() res: FastifyReply,
  ) {
    const buffer = await this.collection.getPreviewImage(shareToken);
    res
      .header("Cache-Control", "public, max-age=86400")
      .header("Content-Length", buffer.length)
      .type("image/jpeg")
      .send(buffer);
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
