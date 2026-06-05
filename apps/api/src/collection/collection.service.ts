import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import {
  CollectionAddResult,
  CollectionCartOffer,
  CollectionFolderDetail,
  CollectionFolderSummary,
  CollectionItem,
  DEFAULT_CARD_VARIANT,
  PriceEstimate,
  PublicCollectionDetail,
} from "@poke-organizer/shared";
import { Prisma } from "@prisma/client";
import { CatalogService } from "../cards/catalog.service";
import {
  fromPrismaLanguage,
  toCardSummary,
  toPrismaCondition,
  toPrismaLanguage,
} from "../common/mappers";
import { PrismaService } from "../prisma/prisma.service";
import {
  AddCollectionItemDto,
  CollectionFolderQueryDto,
  CreateCollectionFolderDto,
  UpdateCollectionFolderDto,
  UpdateCollectionItemDto,
  UpdateCollectionSharingDto,
  UpdateCollectionStoreDto,
  UpdateFolderItemSaleDto,
  CreateCollectionBidDto,
  CreateCollectionCartOfferDto,
  DecideCollectionCartOfferDto,
} from "./dto";
import type { CollectionFolderSort } from "./dto";

const collectionItemInclude = {
  card: true,
  price: { include: { history: { orderBy: { changedAt: "asc" as const } } } },
} satisfies Prisma.CollectionItemInclude;

const folderItemInclude = {
  collectionItem: { include: collectionItemInclude },
  bids: { include: { bidder: true }, orderBy: { createdAt: "desc" as const } },
} satisfies Prisma.CollectionFolderItemInclude;

type CollectionItemWithCard = Prisma.CollectionItemGetPayload<{
  include: typeof collectionItemInclude;
}>;
type FolderWithItems = Prisma.CollectionFolderGetPayload<{
  include: {
    items: { include: typeof folderItemInclude };
  };
}>;

type FolderItemWithStore = Prisma.CollectionFolderItemGetPayload<{
  include: typeof folderItemInclude;
}>;

type CartOfferWithItems = Prisma.CollectionCartOfferGetPayload<{
  include: {
    buyer: true;
    items: { include: { folderItem: { include: typeof folderItemInclude } } };
  };
}>;

@Injectable()
export class CollectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
  ) {}

  async list(userId: string, limit?: number): Promise<CollectionItem[]> {
    const items = await this.prisma.collectionItem.findMany({
      where: { userId },
      include: collectionItemInclude,
      orderBy: { updatedAt: "desc" },
      take: limit,
    });

    return items.map((item) => this.mapItem(item));
  }

  async listFolders(userId: string): Promise<CollectionFolderSummary[]> {
    const folders = await this.prisma.collectionFolder.findMany({
      where: { userId },
      include: {
        items: { include: folderItemInclude },
      },
      orderBy: { updatedAt: "desc" },
    });

    return Promise.all(folders.map((folder) => this.mapFolderSummary(folder)));
  }

  async createFolder(
    userId: string,
    dto: CreateCollectionFolderDto,
  ): Promise<CollectionFolderDetail> {
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException("Collection name is required");
    }

    const folder = await this.prisma.collectionFolder.create({
      data: { userId, name },
      include: {
        items: { include: folderItemInclude },
      },
    });

    return this.mapFolderDetail(folder);
  }

  async getFolder(
    userId: string,
    id: string,
    query: CollectionFolderQueryDto = {},
  ): Promise<CollectionFolderDetail> {
    const folder = await this.prisma.collectionFolder.findFirst({
      where: { id, userId },
      include: {
        items: {
          where: this.folderItemWhere(userId, query),
          include: folderItemInclude,
          orderBy: this.folderItemOrderBy(query.sort),
        },
      },
    });

    if (!folder) {
      throw new NotFoundException("Collection not found");
    }

    return this.mapFolderDetail(folder, query.sort);
  }

  async updateFolder(
    userId: string,
    id: string,
    dto: UpdateCollectionFolderDto,
  ): Promise<CollectionFolderDetail> {
    await this.assertOwnsFolder(userId, id);

    if (dto.itemIds) {
      await this.replaceFolderItems(userId, id, dto.itemIds);
    }

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) {
        throw new BadRequestException("Collection name is required");
      }
      await this.prisma.collectionFolder.update({
        where: { id },
        data: { name },
      });
    }

    return this.getFolder(userId, id);
  }

  async updateFolderSharing(
    userId: string,
    id: string,
    dto: UpdateCollectionSharingDto,
  ): Promise<CollectionFolderDetail> {
    const folder = await this.prisma.collectionFolder.findFirst({
      where: { id, userId },
    });
    if (!folder) {
      throw new NotFoundException("Collection not found");
    }

    const shouldEnsureToken = dto.ensureToken || dto.isPublic === true;
    await this.prisma.collectionFolder.update({
      where: { id },
      data: {
        isPublic: dto.isPublic,
        shareToken:
          shouldEnsureToken && !folder.shareToken
            ? await this.createShareToken()
            : undefined,
      },
    });

    return this.getFolder(userId, id);
  }

  async updateFolderStore(
    userId: string,
    id: string,
    dto: UpdateCollectionStoreDto,
  ): Promise<CollectionFolderDetail> {
    await this.assertOwnsFolder(userId, id);
    await this.prisma.collectionFolder.update({
      where: { id },
      data: { isStore: dto.isStore },
    });
    return this.getFolder(userId, id);
  }

  async updateFolderItemSale(
    userId: string,
    folderId: string,
    folderItemId: string,
    dto: UpdateFolderItemSaleDto,
  ): Promise<CollectionFolderDetail> {
    await this.assertOwnsFolder(userId, folderId);
    const item = await this.assertFolderItem(folderId, folderItemId);
    const isSold = dto.isSold ?? item.isSold;
    await this.prisma.collectionFolderItem.update({
      where: { id: folderItemId },
      data: {
        manualPriceBrl: dto.manualPrice === undefined ? undefined : dto.manualPrice,
        isSold,
        soldPriceBrl: dto.soldPrice === undefined ? undefined : dto.soldPrice,
        soldAt: isSold ? item.soldAt ?? new Date() : null,
      },
    });
    return this.getFolder(userId, folderId);
  }

  async finishAuction(
    userId: string,
    folderId: string,
    folderItemId: string,
  ): Promise<CollectionFolderDetail> {
    await this.assertOwnsFolder(userId, folderId);
    await this.assertFolderItem(folderId, folderItemId);
    const bid = await this.prisma.collectionItemBid.findFirst({
      where: { folderItemId },
      orderBy: { amountBrl: "desc" },
    });
    if (!bid) {
      throw new BadRequestException("Nao ha lances para finalizar este leilao");
    }
    await this.prisma.collectionFolderItem.update({
      where: { id: folderItemId },
      data: {
        isSold: true,
        soldPriceBrl: bid.amountBrl,
        soldAt: new Date(),
        soldToUserId: bid.bidderId,
      },
    });
    return this.getFolder(userId, folderId);
  }

  async createBid(
    userId: string,
    shareToken: string,
    folderItemId: string,
    dto: CreateCollectionBidDto,
  ): Promise<PublicCollectionDetail> {
    const amount = this.assertPositiveMoney(dto.amount);
    const folder = await this.findPublicStoreFolder(shareToken);
    const item = await this.assertFolderItem(folder.id, folderItemId);
    if (item.isSold) {
      throw new BadRequestException("Esta carta ja foi vendida");
    }
    if (folder.userId === userId) {
      throw new BadRequestException("O dono da colecao nao pode dar lance na propria carta");
    }
    const highest = await this.prisma.collectionItemBid.findFirst({
      where: { folderItemId },
      orderBy: { amountBrl: "desc" },
    });
    if (highest && amount <= Number(highest.amountBrl)) {
      throw new BadRequestException("O lance precisa ser maior que o lance atual");
    }

    await this.prisma.collectionItemBid.create({
      data: { folderItemId, bidderId: userId, amountBrl: amount },
    });
    return this.getPublicFolder(shareToken);
  }

  async createCartOffer(
    userId: string,
    shareToken: string,
    dto: CreateCollectionCartOfferDto,
  ): Promise<CollectionCartOffer> {
    const folder = await this.findPublicStoreFolder(shareToken);
    if (folder.userId === userId) {
      throw new BadRequestException("O dono da colecao nao pode enviar proposta para a propria loja");
    }
    if (!dto.items.length) {
      throw new BadRequestException("Inclua pelo menos uma carta na proposta");
    }

    const uniqueFolderItemIds = Array.from(new Set(dto.items.map((item) => item.folderItemId)));
    const folderItems = await this.prisma.collectionFolderItem.findMany({
      where: { id: { in: uniqueFolderItemIds }, folderId: folder.id },
      include: folderItemInclude,
    });
    if (folderItems.length !== uniqueFolderItemIds.length) {
      throw new BadRequestException("A proposta contem cartas invalidas");
    }
    if (folderItems.some((item) => item.isSold)) {
      throw new BadRequestException("A proposta contem carta ja vendida");
    }

    const itemsById = new Map(dto.items.map((item) => [item.folderItemId, item]));
    const total = folderItems.reduce((sum, item) => {
      const offerItem = itemsById.get(item.id);
      return sum + this.assertPositiveMoney(offerItem?.amount ?? 0) * (offerItem?.quantity ?? 1);
    }, 0);

    const offer = await this.prisma.collectionCartOffer.create({
      data: {
        folderId: folder.id,
        buyerId: userId,
        message: dto.message ?? null,
        totalOfferBrl: total,
        items: {
          create: folderItems.map((item) => {
            const offerItem = itemsById.get(item.id)!;
            return {
              folderItemId: item.id,
              quantity: offerItem.quantity ?? 1,
              amountBrl: this.assertPositiveMoney(offerItem.amount),
            };
          }),
        },
      },
      include: {
        buyer: true,
        items: { include: { folderItem: { include: folderItemInclude } } },
      },
    });

    return this.mapCartOffer(offer);
  }

  async listFolderOffers(userId: string, folderId: string): Promise<CollectionCartOffer[]> {
    await this.assertOwnsFolder(userId, folderId);
    const offers = await this.prisma.collectionCartOffer.findMany({
      where: { folderId },
      include: {
        buyer: true,
        items: { include: { folderItem: { include: folderItemInclude } } },
      },
      orderBy: { createdAt: "desc" },
    });
    return offers.map((offer) => this.mapCartOffer(offer));
  }

  async decideCartOffer(
    userId: string,
    folderId: string,
    offerId: string,
    dto: DecideCollectionCartOfferDto,
  ): Promise<CollectionCartOffer> {
    await this.assertOwnsFolder(userId, folderId);
    const offer = await this.prisma.collectionCartOffer.findFirst({
      where: { id: offerId, folderId },
      include: {
        buyer: true,
        items: { include: { folderItem: { include: folderItemInclude } } },
      },
    });
    if (!offer) {
      throw new NotFoundException("Proposta nao encontrada");
    }
    if (offer.status !== "PENDING") {
      throw new BadRequestException("Esta proposta ja foi decidida");
    }

    const status = dto.status === "accepted" ? "ACCEPTED" : "REJECTED";
    const updated = await this.prisma.$transaction(async (tx) => {
      const decided = await tx.collectionCartOffer.update({
        where: { id: offerId },
        data: { status, decidedAt: new Date() },
        include: {
          buyer: true,
          items: { include: { folderItem: { include: folderItemInclude } } },
        },
      });
      if (status === "ACCEPTED") {
        for (const item of offer.items) {
          await tx.collectionFolderItem.update({
            where: { id: item.folderItemId },
            data: {
              isSold: true,
              soldPriceBrl: item.amountBrl,
              soldAt: new Date(),
              soldToUserId: offer.buyerId,
            },
          });
        }
      }
      return decided;
    });

    return this.mapCartOffer(updated);
  }

  async getPublicFolder(
    shareToken: string,
    query: CollectionFolderQueryDto = {},
  ): Promise<PublicCollectionDetail> {
    const folder = await this.prisma.collectionFolder.findFirst({
      where: { shareToken, isPublic: true },
      include: {
        user: true,
        items: {
          where: this.publicFolderItemWhere(query),
          include: folderItemInclude,
          orderBy: this.folderItemOrderBy(query.sort),
        },
      },
    });

    if (!folder) {
      throw new NotFoundException("Public collection not found");
    }

    return {
      ...(await this.mapFolderDetail(folder, query.sort)),
      isPublic: true,
      ownerName: folder.user.name?.trim() || "Colecionador",
    };
  }

  async removeFolder(userId: string, id: string) {
    await this.assertOwnsFolder(userId, id);
    await this.prisma.collectionFolder.delete({ where: { id } });
    return { ok: true };
  }

  async add(
    userId: string,
    dto: AddCollectionItemDto,
  ): Promise<CollectionAddResult> {
    let card = await this.prisma.card.findFirst({
      where: { OR: [{ id: dto.cardId }, { externalId: dto.cardId }] },
    });
    if (!card) {
      const ensured = await this.catalog.ensureCardByExternalId(dto.cardId);
      card = await this.prisma.card.findUniqueOrThrow({
        where: { id: ensured.id },
      });
    }

    const condition = toPrismaCondition(dto.condition);
    const language = toPrismaLanguage(dto.language);
    const variant = dto.variant ?? DEFAULT_CARD_VARIANT;
    const foil = dto.foil ?? false;

    this.assertValidVariant(card.variants, variant);
    const cardPriceId = await this.findCardPriceId(card);
    const existing = await this.prisma.collectionItem.findUnique({
      where: {
        userId_cardId_condition_variant_foil_language: {
          userId,
          cardId: card.id,
          condition,
          variant,
          foil,
          language,
        },
      },
    });

    const item = await this.prisma.collectionItem.upsert({
      where: {
        userId_cardId_condition_variant_foil_language: {
          userId,
          cardId: card.id,
          condition,
          variant,
          foil,
          language,
        },
      },
      create: {
        userId,
        cardId: card.id,
        quantity: dto.quantity ?? 1,
        condition,
        variant,
        foil,
        language,
        cardPriceId,
        notes: dto.notes ?? null,
      },
      update: {
        quantity: { increment: dto.quantity ?? 1 },
        cardPriceId: existing?.cardPriceId ?? cardPriceId,
        notes: dto.notes ?? undefined,
      },
      include: collectionItemInclude,
    });

    return {
      item: this.mapItem(item),
      action: existing ? "incremented" : "created",
    };
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateCollectionItemDto,
  ): Promise<CollectionItem> {
    await this.assertOwnsItem(userId, id);
    if (dto.variant) {
      const current = await this.prisma.collectionItem.findUnique({
        where: { id },
        include: { card: true },
      });
      this.assertValidVariant(current?.card.variants ?? [], dto.variant);
    }

    const item = await this.prisma.collectionItem.update({
      where: { id },
      data: {
        quantity: dto.quantity,
        condition: dto.condition ? toPrismaCondition(dto.condition) : undefined,
        variant: dto.variant,
        foil: dto.foil,
        language: dto.language ? toPrismaLanguage(dto.language) : undefined,
        notes: dto.notes,
      },
      include: collectionItemInclude,
    });

    return this.mapItem(item);
  }

  async remove(userId: string, id: string) {
    await this.assertOwnsItem(userId, id);
    await this.prisma.collectionItem.delete({ where: { id } });
    return { ok: true };
  }

  private async assertOwnsItem(userId: string, id: string) {
    const item = await this.prisma.collectionItem.findFirst({
      where: { id, userId },
    });
    if (!item) {
      throw new NotFoundException("Collection item not found");
    }
  }

  private async assertOwnsFolder(userId: string, id: string) {
    const folder = await this.prisma.collectionFolder.findFirst({
      where: { id, userId },
    });
    if (!folder) {
      throw new NotFoundException("Collection not found");
    }
  }

  private async assertFolderItem(folderId: string, folderItemId: string) {
    const item = await this.prisma.collectionFolderItem.findFirst({
      where: { id: folderItemId, folderId },
      include: folderItemInclude,
    });
    if (!item) {
      throw new NotFoundException("Carta da colecao nao encontrada");
    }
    return item;
  }

  private async findPublicStoreFolder(shareToken: string) {
    const folder = await this.prisma.collectionFolder.findFirst({
      where: { shareToken, isPublic: true, isStore: true },
    });
    if (!folder) {
      throw new NotFoundException("Loja publica nao encontrada");
    }
    return folder;
  }

  private async replaceFolderItems(
    userId: string,
    folderId: string,
    itemIds: string[],
  ) {
    const uniqueItemIds = Array.from(new Set(itemIds));
    const ownedCount = await this.prisma.collectionItem.count({
      where: { userId, id: { in: uniqueItemIds } },
    });

    if (ownedCount !== uniqueItemIds.length) {
      throw new BadRequestException(
        "Some selected cards do not belong to this user",
      );
    }

    const existingItems = await this.prisma.collectionFolderItem.findMany({
      where: { folderId },
      select: { id: true, collectionItemId: true },
    });
    const selectedItemIds = new Set(uniqueItemIds);
    const existingItemIds = new Set(existingItems.map((item) => item.collectionItemId));
    const folderItemIdsToDelete = existingItems
      .filter((item) => !selectedItemIds.has(item.collectionItemId))
      .map((item) => item.id);
    const collectionItemIdsToCreate = uniqueItemIds.filter((itemId) => !existingItemIds.has(itemId));

    const operations: Prisma.PrismaPromise<unknown>[] = [];
    if (folderItemIdsToDelete.length) {
      operations.push(
        this.prisma.collectionFolderItem.deleteMany({
          where: { id: { in: folderItemIdsToDelete } },
        }),
      );
    }
    if (collectionItemIdsToCreate.length) {
      operations.push(
        this.prisma.collectionFolderItem.createMany({
          data: collectionItemIdsToCreate.map((collectionItemId) => ({
            folderId,
            collectionItemId,
          })),
          skipDuplicates: true,
        }),
      );
    }
    if (operations.length) {
      await this.prisma.$transaction(operations);
    }
  }

  private folderItemWhere(
    userId: string,
    query: CollectionFolderQueryDto,
  ): Prisma.CollectionFolderItemWhereInput {
    const cardFilter: Prisma.CardWhereInput = {};
    if (query.type) {
      cardFilter.types = { has: query.type };
    }
    if (query.rarity) {
      cardFilter.rarity = query.rarity;
    }

    return {
      collectionItem: {
        userId,
        variant: query.variant || undefined,
        card: Object.keys(cardFilter).length ? cardFilter : undefined,
      },
    };
  }

  private publicFolderItemWhere(
    query: CollectionFolderQueryDto,
  ): Prisma.CollectionFolderItemWhereInput {
    const cardFilter: Prisma.CardWhereInput = {};
    if (query.type) {
      cardFilter.types = { has: query.type };
    }
    if (query.rarity) {
      cardFilter.rarity = query.rarity;
    }

    return {
      collectionItem: {
        variant: query.variant || undefined,
        card: Object.keys(cardFilter).length ? cardFilter : undefined,
      },
    };
  }

  private folderItemOrderBy(
    sort?: CollectionFolderSort,
  ): Prisma.CollectionFolderItemOrderByWithRelationInput {
    if (sort === "oldest") {
      return { createdAt: "asc" };
    }
    return { collectionItem: { updatedAt: "desc" } };
  }

  private assertValidVariant(validVariants: string[], variant: string) {
    const allowed = validVariants.length
      ? validVariants
      : [DEFAULT_CARD_VARIANT];
    if (!allowed.includes(variant)) {
      throw new BadRequestException(
        `Invalid variant. Allowed variants: ${allowed.join(", ")}`,
      );
    }
  }

  private async findCardPriceId(card: {
    number: string;
    printedTotal: number | null;
    setCode?: string | null;
    raw?: unknown;
  }): Promise<string | null> {
    const setCode = this.cardSetCode(card);
    if (!setCode || !card.printedTotal) return null;

    const price = await this.prisma.cardPrice.findFirst({
      where: {
        setCode,
        number: normalizeCardNumber(card.number),
        printedTotal: card.printedTotal,
      },
      orderBy: [{ provider: "asc" }, { lastCheckedAt: "desc" }],
    });

    return price?.id ?? null;
  }

  private mapItem(item: CollectionItemWithCard, folderItem?: FolderItemWithStore): CollectionItem {
    const bids = folderItem?.bids.map((bid) => ({
      id: bid.id,
      bidderId: bid.bidderId,
      bidderName: bid.bidder.name?.trim() || bid.bidder.email,
      amount: Number(bid.amountBrl),
      createdAt: bid.createdAt.toISOString(),
    })) ?? [];
    const highestBid = bids.length
      ? [...bids].sort((left, right) => right.amount - left.amount)[0]
      : null;
    const manualPrice = folderItem?.manualPriceBrl === null || folderItem?.manualPriceBrl === undefined
      ? null
      : Number(folderItem.manualPriceBrl);
    const catalogPrice = this.mapCardPrice(item.price);

    return {
      id: item.id,
      folderItemId: folderItem?.id,
      card: toCardSummary(item.card),
      quantity: item.quantity,
      condition: item.condition,
      variant: item.variant,
      foil: item.foil,
      language: fromPrismaLanguage(item.language),
      notes: item.notes,
      price: catalogPrice,
      store: folderItem ? {
        manualPrice,
        effectivePrice: manualPrice ?? catalogPrice?.amount ?? null,
        isSold: folderItem.isSold,
        soldPrice: folderItem.soldPriceBrl === null ? null : Number(folderItem.soldPriceBrl),
        soldAt: folderItem.soldAt?.toISOString() ?? null,
        highestBid,
        bids,
      } : null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  private async mapFolderSummary(
    folder: FolderWithItems,
  ): Promise<CollectionFolderSummary> {
    const items = folder.items.map((entry) => entry.collectionItem);
    const totalValue = items.reduce(
      (sum, item) =>
        sum + (this.mapCardPrice(item.price)?.amount ?? 0) * item.quantity,
      0,
    );

    return {
      id: folder.id,
      name: folder.name,
      isPublic: folder.isPublic,
      isStore: folder.isStore,
      shareToken: folder.shareToken,
      itemCount: folder.items.length,
      totalValue,
      createdAt: folder.createdAt.toISOString(),
      updatedAt: folder.updatedAt.toISOString(),
    };
  }

  private async mapFolderDetail(
    folder: FolderWithItems,
    sort?: CollectionFolderSort,
  ): Promise<CollectionFolderDetail> {
    const items = folder.items.map((entry) => this.mapItem(entry.collectionItem, entry));
    const sortedItems = this.sortFolderItems(items, sort);
    const totalValue = items.reduce(
      (sum, item) => sum + (item.price?.amount ?? 0) * item.quantity,
      0,
    );

    return {
      id: folder.id,
      name: folder.name,
      isPublic: folder.isPublic,
      isStore: folder.isStore,
      shareToken: folder.shareToken,
      itemCount: folder.items.length,
      totalValue,
      items: sortedItems,
      createdAt: folder.createdAt.toISOString(),
      updatedAt: folder.updatedAt.toISOString(),
    };
  }

  private sortFolderItems(
    items: CollectionItem[],
    sort?: CollectionFolderSort,
  ): CollectionItem[] {
    if (sort === "value-desc") {
      return [...items].sort(
        (left, right) => (right.price?.amount ?? 0) - (left.price?.amount ?? 0),
      );
    }
    if (sort === "value-asc") {
      return [...items].sort(
        (left, right) => (left.price?.amount ?? 0) - (right.price?.amount ?? 0),
      );
    }
    if (sort === "price-change-desc") {
      return [...items].sort(
        (left, right) => latestPriceChange(right) - latestPriceChange(left),
      );
    }
    if (sort === "price-change-asc") {
      return [...items].sort(
        (left, right) => latestPriceChange(left) - latestPriceChange(right),
      );
    }
    if (sort === "oldest") {
      return [...items].sort(
        (left, right) =>
          Date.parse(left.createdAt) - Date.parse(right.createdAt),
      );
    }
    return [...items].sort(
      (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
    );
  }

  private mapCardPrice(
    price: CollectionItemWithCard["price"],
  ): PriceEstimate | null {
    if (!price) return null;

    return {
      source: price.provider === "LIGAPOKEMON" ? "ligapokemon" : "mypcards",
      currency: "BRL",
      amount: Number(price.amountBrl),
      label: price.label,
      history: price.history.map((entry) => ({
        previousAmount: Number(entry.previousAmountBrl),
        amount: Number(entry.newAmountBrl),
        changedAt: entry.changedAt.toISOString(),
      })),
      updatedAt: price.lastCheckedAt.toISOString(),
      isFallback: false,
      status: "fresh",
    };
  }

  private mapCartOffer(offer: CartOfferWithItems): CollectionCartOffer {
    return {
      id: offer.id,
      folderId: offer.folderId,
      buyerId: offer.buyerId,
      buyerName: offer.buyer.name?.trim() || offer.buyer.email,
      status: offer.status === "ACCEPTED" ? "accepted" : offer.status === "REJECTED" ? "rejected" : "pending",
      message: offer.message,
      totalOffer: Number(offer.totalOfferBrl),
      decidedAt: offer.decidedAt?.toISOString() ?? null,
      createdAt: offer.createdAt.toISOString(),
      updatedAt: offer.updatedAt.toISOString(),
      items: offer.items.map((item) => ({
        id: item.id,
        folderItemId: item.folderItemId,
        quantity: item.quantity,
        amount: Number(item.amountBrl),
        item: this.mapItem(item.folderItem.collectionItem, item.folderItem),
      })),
    };
  }

  private assertPositiveMoney(value: number): number {
    if (!Number.isFinite(value) || value <= 0) {
      throw new BadRequestException("Informe um valor maior que zero");
    }
    return Math.round(value * 100) / 100;
  }

  private cardSetCode(card: {
    setCode?: string | null;
    raw?: unknown;
  }): string | null {
    const raw = card.raw as { set?: { ptcgoCode?: string | null } } | null;
    const code = card.setCode ?? raw?.set?.ptcgoCode ?? null;
    return code ? code.trim().toUpperCase() : null;
  }

  private async createShareToken(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const token = randomBytes(18).toString("base64url");
      const existing = await this.prisma.collectionFolder.findUnique({
        where: { shareToken: token },
      });
      if (!existing) {
        return token;
      }
    }

    throw new BadRequestException("Unable to create share link");
  }
}

function normalizeCardNumber(number: string): string {
  return number.trim().replace(/^0+(?=\d)/, "");
}

function latestPriceChange(item: CollectionItem): number {
  const history = item.price?.history ?? [];
  const latest = history[history.length - 1];
  return latest ? latest.amount - latest.previousAmount : 0;
}
