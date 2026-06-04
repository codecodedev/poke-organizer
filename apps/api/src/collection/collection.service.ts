import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import {
  CollectionAddResult,
  CollectionFolderDetail,
  CollectionFolderSummary,
  CollectionItem,
  DEFAULT_CARD_VARIANT,
  PriceEstimate,
  PublicCollectionDetail
} from "@poke-organizer/shared";
import { Prisma } from "@prisma/client";
import { CatalogService } from "../cards/catalog.service";
import { fromPrismaLanguage, toCardSummary, toPrismaCondition, toPrismaLanguage } from "../common/mappers";
import { PrismaService } from "../prisma/prisma.service";
import {
  AddCollectionItemDto,
  CollectionFolderQueryDto,
  CreateCollectionFolderDto,
  UpdateCollectionFolderDto,
  UpdateCollectionItemDto,
  UpdateCollectionSharingDto
} from "./dto";
import type { CollectionFolderSort } from "./dto";

type CollectionItemWithCard = Prisma.CollectionItemGetPayload<{ include: { card: true; price: true } }>;
type FolderWithItems = Prisma.CollectionFolderGetPayload<{
  include: { items: { include: { collectionItem: { include: { card: true; price: true } } } } };
}>;

@Injectable()
export class CollectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService
  ) {}

  async list(userId: string, limit?: number): Promise<CollectionItem[]> {
    const items = await this.prisma.collectionItem.findMany({
      where: { userId },
      include: { card: true, price: true },
      orderBy: { updatedAt: "desc" },
      take: limit
    });

    return items.map((item) => this.mapItem(item));
  }

  async listFolders(userId: string): Promise<CollectionFolderSummary[]> {
    const folders = await this.prisma.collectionFolder.findMany({
      where: { userId },
      include: { items: { include: { collectionItem: { include: { card: true, price: true } } } } },
      orderBy: { updatedAt: "desc" }
    });

    return Promise.all(folders.map((folder) => this.mapFolderSummary(folder)));
  }

  async createFolder(userId: string, dto: CreateCollectionFolderDto): Promise<CollectionFolderDetail> {
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException("Collection name is required");
    }

    const folder = await this.prisma.collectionFolder.create({
      data: { userId, name },
      include: { items: { include: { collectionItem: { include: { card: true, price: true } } } } }
    });

    return this.mapFolderDetail(folder);
  }

  async getFolder(userId: string, id: string, query: CollectionFolderQueryDto = {}): Promise<CollectionFolderDetail> {
    const folder = await this.prisma.collectionFolder.findFirst({
      where: { id, userId },
      include: {
        items: {
          where: this.folderItemWhere(userId, query),
          include: { collectionItem: { include: { card: true, price: true } } },
          orderBy: this.folderItemOrderBy(query.sort)
        }
      }
    });

    if (!folder) {
      throw new NotFoundException("Collection not found");
    }

    return this.mapFolderDetail(folder, query.sort);
  }

  async updateFolder(userId: string, id: string, dto: UpdateCollectionFolderDto): Promise<CollectionFolderDetail> {
    await this.assertOwnsFolder(userId, id);

    if (dto.itemIds) {
      await this.replaceFolderItems(userId, id, dto.itemIds);
    }

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) {
        throw new BadRequestException("Collection name is required");
      }
      await this.prisma.collectionFolder.update({ where: { id }, data: { name } });
    }

    return this.getFolder(userId, id);
  }

  async updateFolderSharing(userId: string, id: string, dto: UpdateCollectionSharingDto): Promise<CollectionFolderDetail> {
    const folder = await this.prisma.collectionFolder.findFirst({ where: { id, userId } });
    if (!folder) {
      throw new NotFoundException("Collection not found");
    }

    const shouldEnsureToken = dto.ensureToken || dto.isPublic === true;
    await this.prisma.collectionFolder.update({
      where: { id },
      data: {
        isPublic: dto.isPublic,
        shareToken: shouldEnsureToken && !folder.shareToken ? await this.createShareToken() : undefined
      }
    });

    return this.getFolder(userId, id);
  }

  async getPublicFolder(shareToken: string, query: CollectionFolderQueryDto = {}): Promise<PublicCollectionDetail> {
    const folder = await this.prisma.collectionFolder.findFirst({
      where: { shareToken, isPublic: true },
      include: {
        items: {
          where: this.publicFolderItemWhere(query),
          include: { collectionItem: { include: { card: true, price: true } } },
          orderBy: this.folderItemOrderBy(query.sort)
        }
      }
    });

    if (!folder) {
      throw new NotFoundException("Public collection not found");
    }

    return {
      ...(await this.mapFolderDetail(folder, query.sort)),
      isPublic: true
    };
  }

  async removeFolder(userId: string, id: string) {
    await this.assertOwnsFolder(userId, id);
    await this.prisma.collectionFolder.delete({ where: { id } });
    return { ok: true };
  }

  async add(userId: string, dto: AddCollectionItemDto): Promise<CollectionAddResult> {
    let card = await this.prisma.card.findFirst({
      where: { OR: [{ id: dto.cardId }, { externalId: dto.cardId }] }
    });
    if (!card) {
      const ensured = await this.catalog.ensureCardByExternalId(dto.cardId);
      card = await this.prisma.card.findUniqueOrThrow({ where: { id: ensured.id } });
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
          language
        }
      }
    });

    const item = await this.prisma.collectionItem.upsert({
      where: {
        userId_cardId_condition_variant_foil_language: {
          userId,
          cardId: card.id,
          condition,
          variant,
          foil,
          language
        }
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
        notes: dto.notes ?? null
      },
      update: {
        quantity: { increment: dto.quantity ?? 1 },
        cardPriceId: existing?.cardPriceId ?? cardPriceId,
        notes: dto.notes ?? undefined
      },
      include: { card: true, price: true }
    });

    return {
      item: this.mapItem(item),
      action: existing ? "incremented" : "created"
    };
  }

  async update(userId: string, id: string, dto: UpdateCollectionItemDto): Promise<CollectionItem> {
    await this.assertOwnsItem(userId, id);
    if (dto.variant) {
      const current = await this.prisma.collectionItem.findUnique({ where: { id }, include: { card: true } });
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
        notes: dto.notes
      },
      include: { card: true, price: true }
    });

    return this.mapItem(item);
  }

  async remove(userId: string, id: string) {
    await this.assertOwnsItem(userId, id);
    await this.prisma.collectionItem.delete({ where: { id } });
    return { ok: true };
  }

  private async assertOwnsItem(userId: string, id: string) {
    const item = await this.prisma.collectionItem.findFirst({ where: { id, userId } });
    if (!item) {
      throw new NotFoundException("Collection item not found");
    }
  }

  private async assertOwnsFolder(userId: string, id: string) {
    const folder = await this.prisma.collectionFolder.findFirst({ where: { id, userId } });
    if (!folder) {
      throw new NotFoundException("Collection not found");
    }
  }

  private async replaceFolderItems(userId: string, folderId: string, itemIds: string[]) {
    const uniqueItemIds = Array.from(new Set(itemIds));
    const ownedCount = await this.prisma.collectionItem.count({
      where: { userId, id: { in: uniqueItemIds } }
    });

    if (ownedCount !== uniqueItemIds.length) {
      throw new BadRequestException("Some selected cards do not belong to this user");
    }

    await this.prisma.$transaction([
      this.prisma.collectionFolderItem.deleteMany({ where: { folderId } }),
      this.prisma.collectionFolderItem.createMany({
        data: uniqueItemIds.map((collectionItemId) => ({ folderId, collectionItemId })),
        skipDuplicates: true
      })
    ]);
  }

  private folderItemWhere(userId: string, query: CollectionFolderQueryDto): Prisma.CollectionFolderItemWhereInput {
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
        card: Object.keys(cardFilter).length ? cardFilter : undefined
      }
    };
  }

  private publicFolderItemWhere(query: CollectionFolderQueryDto): Prisma.CollectionFolderItemWhereInput {
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
        card: Object.keys(cardFilter).length ? cardFilter : undefined
      }
    };
  }

  private folderItemOrderBy(sort?: CollectionFolderSort): Prisma.CollectionFolderItemOrderByWithRelationInput {
    if (sort === "oldest") {
      return { createdAt: "asc" };
    }
    return { createdAt: "desc" };
  }

  private assertValidVariant(validVariants: string[], variant: string) {
    const allowed = validVariants.length ? validVariants : [DEFAULT_CARD_VARIANT];
    if (!allowed.includes(variant)) {
      throw new BadRequestException(`Invalid variant. Allowed variants: ${allowed.join(", ")}`);
    }
  }

  private async findCardPriceId(card: { number: string; printedTotal: number | null; setCode?: string | null; raw?: unknown }): Promise<string | null> {
    const setCode = this.cardSetCode(card);
    if (!setCode || !card.printedTotal) return null;

    const price = await this.prisma.cardPrice.findFirst({
      where: {
        setCode,
        number: normalizeCardNumber(card.number),
        printedTotal: card.printedTotal
      },
      orderBy: [{ provider: "asc" }, { lastCheckedAt: "desc" }]
    });

    return price?.id ?? null;
  }

  private mapItem(item: CollectionItemWithCard): CollectionItem {
    return {
      id: item.id,
      card: toCardSummary(item.card),
      quantity: item.quantity,
      condition: item.condition,
      variant: item.variant,
      foil: item.foil,
      language: fromPrismaLanguage(item.language),
      notes: item.notes,
      price: this.mapCardPrice(item.price),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString()
    };
  }

  private async mapFolderSummary(folder: FolderWithItems): Promise<CollectionFolderSummary> {
    const items = folder.items.map((entry) => entry.collectionItem);
    const totalValue = items.reduce((sum, item) => sum + (this.mapCardPrice(item.price)?.amount ?? 0) * item.quantity, 0);

    return {
      id: folder.id,
      name: folder.name,
      isPublic: folder.isPublic,
      shareToken: folder.shareToken,
      itemCount: folder.items.length,
      totalValue,
      createdAt: folder.createdAt.toISOString(),
      updatedAt: folder.updatedAt.toISOString()
    };
  }

  private async mapFolderDetail(folder: FolderWithItems, sort?: CollectionFolderSort): Promise<CollectionFolderDetail> {
    const sourceItems = folder.items.map((entry) => entry.collectionItem);
    const items = sourceItems.map((item) => this.mapItem(item));
    const sortedItems = this.sortFolderItems(items, sort);
    const totalValue = items.reduce((sum, item) => sum + (item.price?.amount ?? 0) * item.quantity, 0);

    return {
      id: folder.id,
      name: folder.name,
      isPublic: folder.isPublic,
      shareToken: folder.shareToken,
      itemCount: folder.items.length,
      totalValue,
      items: sortedItems,
      createdAt: folder.createdAt.toISOString(),
      updatedAt: folder.updatedAt.toISOString()
    };
  }

  private sortFolderItems(items: CollectionItem[], sort?: CollectionFolderSort): CollectionItem[] {
    if (sort === "value-desc") {
      return [...items].sort((left, right) => (right.price?.amount ?? 0) - (left.price?.amount ?? 0));
    }
    if (sort === "value-asc") {
      return [...items].sort((left, right) => (left.price?.amount ?? 0) - (right.price?.amount ?? 0));
    }
    if (sort === "oldest") {
      return [...items].sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
    }
    return [...items].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  }

  private mapCardPrice(price: CollectionItemWithCard["price"]): PriceEstimate | null {
    if (!price) return null;

    return {
      source: price.provider === "LIGAPOKEMON" ? "ligapokemon" : "mypcards",
      currency: "BRL",
      amount: Number(price.amountBrl),
      label: price.label,
      updatedAt: price.lastCheckedAt.toISOString(),
      isFallback: false,
      status: "fresh"
    };
  }

  private cardSetCode(card: { setCode?: string | null; raw?: unknown }): string | null {
    const raw = card.raw as { set?: { ptcgoCode?: string | null } } | null;
    const code = card.setCode ?? raw?.set?.ptcgoCode ?? null;
    return code ? code.trim().toUpperCase() : null;
  }

  private async createShareToken(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const token = randomBytes(18).toString("base64url");
      const existing = await this.prisma.collectionFolder.findUnique({ where: { shareToken: token } });
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
