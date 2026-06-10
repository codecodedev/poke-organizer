import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { promises as fs } from "node:fs";
import sharp from "sharp";
import { StorageService } from "../storage/storage.service";
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
import { AuthService } from "../auth/auth.service";
import { EmailService } from "../email/email.service";
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
  CreateCollectionCartOfferDto,
  DecideCollectionCartOfferDto,
  ClearCollectionDto,
  AddFolderPermissionDto,
  UndoFolderItemSaleDto,
} from "./dto";
import type { CollectionFolderSort } from "./dto";

const collectionItemInclude = {
  card: true,
  price: { include: { history: { orderBy: { changedAt: "asc" as const } } } },
} satisfies Prisma.CollectionItemInclude;

const folderItemInclude = {
  collectionItem: { include: collectionItemInclude },
  folder: true,
} satisfies Prisma.CollectionFolderItemInclude;

const auctionInclude = {
  collectionItem: { include: { card: true } },
  seller: true,
  bids: { orderBy: { amountBrl: "desc" as const }, take: 1 },
} satisfies Prisma.AuctionInclude;

type CollectionItemWithCard = Prisma.CollectionItemGetPayload<{
  include: typeof collectionItemInclude;
}>;
type FolderWithItems = Prisma.CollectionFolderGetPayload<{
  include: {
    items: { include: typeof folderItemInclude };
  };
}>;

type AuctionWithRelations = Prisma.AuctionGetPayload<{
  include: typeof auctionInclude;
}>;

type FolderItemWithStore = Prisma.CollectionFolderItemGetPayload<{
  include: typeof folderItemInclude;
}>;

type CartOfferWithItems = Prisma.CollectionCartOfferGetPayload<{
  include: {
    buyer: true;
    folder: { include: { user: true } };
    items: { include: { folderItem: { include: typeof folderItemInclude } } };
  };
}>;

@Injectable()
export class CollectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
    private readonly auth: AuthService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
    private readonly storage: StorageService,
  ) {}

  async clearCollection(userId: string, dto: ClearCollectionDto) {
    const isPasswordValid = await this.auth.verifyPassword(userId, dto.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException("Senha incorreta");
    }

    await this.prisma.collectionItem.deleteMany({
      where: { userId },
    });

    return { ok: true };
  }

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
        user: true,
        items: { include: folderItemInclude },
      },
      orderBy: { name: "asc" },
    });
    return Promise.all(folders.map((folder) => this.mapFolderSummary(folder as any)));
  }

  async listMyProposals(userId: string): Promise<CollectionCartOffer[]> {
    const offers = await this.prisma.collectionCartOffer.findMany({
      where: { buyerId: userId },
      include: {
        buyer: true,
        folder: { include: { user: true } },
        items: { include: { folderItem: { include: folderItemInclude } } },
      },
      orderBy: { createdAt: "desc" },
    });
    return offers.map((offer) => this.mapCartOffer(offer));
  }

  async createFolder(
    userId: string,
    dto: CreateCollectionFolderDto,
  ): Promise<CollectionFolderDetail> {
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException("Collection name is required");
    }

    const existing = await this.prisma.collectionFolder.findUnique({
      where: { userId_name: { userId, name } },
    });

    if (existing) {
      throw new BadRequestException("Você já possui uma coleção com este nome");
    }

    const folder = await this.prisma.collectionFolder.create({
      data: { userId, name, isStore: dto.isStore ?? false },
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

  async getFolderPermissions(userId: string, folderId: string) {
    await this.assertOwnsFolder(userId, folderId);
    return this.prisma.collectionFolderPermission.findMany({
      where: { folderId },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  async addFolderPermission(
    userId: string,
    folderId: string,
    dto: AddFolderPermissionDto,
  ) {
    await this.assertOwnsFolder(userId, folderId);
    const targetUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!targetUser) {
      throw new NotFoundException("Usuário não encontrado com este e-mail");
    }
    if (targetUser.id === userId) {
      throw new BadRequestException("Você já é o dono desta coleção");
    }

    return this.prisma.collectionFolderPermission.upsert({
      where: {
        folderId_userId: {
          folderId,
          userId: targetUser.id,
        },
      },
      create: {
        folderId,
        userId: targetUser.id,
      },
      update: {},
      include: { user: { select: { id: true, email: true, name: true } } },
    });
  }

  async removeFolderPermission(
    userId: string,
    folderId: string,
    permissionId: string,
  ) {
    await this.assertOwnsFolder(userId, folderId);
    await this.prisma.collectionFolderPermission.delete({
      where: { id: permissionId, folderId },
    });
    return { ok: true };
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

      const existing = await this.prisma.collectionFolder.findUnique({
        where: { userId_name: { userId, name } },
      });

      if (existing && existing.id !== id) {
        throw new BadRequestException("Você já possui uma coleção com este nome");
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
    
    // Se estiver removendo o banner, deletar do storage
    if (dto.bannerUrl === null && folder.bannerUrl) {
      await this.storage.deleteBanner(folder.bannerUrl);
    }

    await this.prisma.collectionFolder.update({
      where: { id },
      data: {
        isPublic: dto.isPublic,
        bannerUrl: dto.bannerUrl === undefined ? undefined : dto.bannerUrl,
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

  async uploadBanner(
    userId: string,
    id: string,
    file: any, // MultipartFile
  ): Promise<CollectionFolderDetail> {
    const folder = await this.assertOwnsFolder(userId, id);

    let buffer = await file.toBuffer();

    // Redimensionar para evitar imagens gigantes e problemas de preview
    // Limite de 1200px de largura, mantendo proporção, qualidade 80
    buffer = await sharp(buffer)
      .resize({ width: 1200, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    // Deletar banner antigo se existir
    if (folder.bannerUrl) {
      await this.storage.deleteBanner(folder.bannerUrl);
    }

    const bannerUrl = await this.storage.uploadBanner(id, buffer, "image/jpeg");

    await this.prisma.collectionFolder.update({
      where: { id },
      data: { bannerUrl },
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
    const isSoldRequest = dto.isSold ?? false;
    const currentQuantity = item.collectionItem.quantity;
    const soldQuantity = dto.quantity ?? (isSoldRequest ? currentQuantity : 0);
    const totalSoldNow = isSoldRequest ? item.soldQuantity + soldQuantity : item.soldQuantity;

    await this.prisma.$transaction(async (tx) => {
      await tx.collectionFolderItem.update({
        where: { id: folderItemId },
        data: {
          manualPriceBrl: dto.manualPrice === undefined ? undefined : dto.manualPrice,
          isSold: isSoldRequest ? totalSoldNow >= currentQuantity : item.isSold,
          soldQuantity: totalSoldNow,
          soldPriceBrl: dto.soldPrice === undefined ? undefined : dto.soldPrice,
          soldAt: isSoldRequest ? new Date() : item.soldAt,
        },
      });
    });

    return this.getFolder(userId, folderId);
  }

  async undoFolderItemSale(
    userId: string,
    folderId: string,
    folderItemId: string,
    dto: UndoFolderItemSaleDto = {},
  ): Promise<CollectionFolderDetail> {
    await this.assertOwnsFolder(userId, folderId);
    const item = await this.assertFolderItem(folderId, folderItemId);

    const quantityToUndo = dto.quantity ?? item.soldQuantity;
    const newSoldQuantity = Math.max(0, item.soldQuantity - quantityToUndo);

    if (newSoldQuantity === 0) {
      await this.prisma.collectionFolderItem.update({
        where: { id: folderItemId },
        data: {
          isSold: false,
          soldQuantity: 0,
          soldPriceBrl: null,
          soldAt: null,
          soldToUserId: null,
        },
      });
    } else {
      await this.prisma.collectionFolderItem.update({
        where: { id: folderItemId },
        data: {
          isSold: false,
          soldQuantity: newSoldQuantity,
        },
      });
    }

    return this.getFolder(userId, folderId);
  }

  async createCartOffer(
    userId: string,
    shareToken: string,
    dto: CreateCollectionCartOfferDto,
  ): Promise<CollectionCartOffer> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.whatsapp) {
      throw new BadRequestException("Você precisa cadastrar um número de WhatsApp no seu perfil para enviar propostas.");
    }

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
    const calculatedTotal = folderItems.reduce((sum, item) => {
      const offerItem = itemsById.get(item.id);
      const amount = dto.isGlobalOffer 
         ? Math.max(0, offerItem?.amount ?? 0)
         : this.assertPositiveMoney(offerItem?.amount ?? 0);
      return sum + amount * (offerItem?.quantity ?? 1);
    }, 0);

    const totalOfferBrl = dto.isGlobalOffer && dto.totalOffer !== undefined
      ? this.assertPositiveMoney(dto.totalOffer)
      : calculatedTotal;

    const offer = await this.prisma.collectionCartOffer.create({
      data: {
        folderId: folder.id,
        buyerId: userId,
        message: dto.message ?? null,
        totalOfferBrl,
        isGlobalOffer: dto.isGlobalOffer ?? false,
        items: {
          create: folderItems.map((item) => {
            const offerItem = itemsById.get(item.id)!;
            return {
              folderItemId: item.id,
              quantity: offerItem.quantity ?? 1,
              amountBrl: dto.isGlobalOffer 
                ? Math.max(0, offerItem.amount) 
                : this.assertPositiveMoney(offerItem.amount),
            };
          }),
        },
      },
      include: {
        buyer: true,
        folder: { include: { user: true } },
        items: { include: { folderItem: { include: folderItemInclude } } },
      },
    });

    await this.prisma.notification.create({
      data: {
        userId: folder.userId,
        title: "Nova Proposta Recebida!",
        message: `${offer.buyer.name || offer.buyer.email} enviou uma proposta na coleção "${folder.name}".`,
        link: `/collections/${folder.id}?openProposals=true`,
      },
    });

    // Send email notification
    const seller = await this.prisma.user.findUnique({ where: { id: folder.userId } });
    if (seller) {
      void this.emailService.sendNewProposalEmail(seller.email, offer.buyer.name || offer.buyer.email, folder.name, totalOfferBrl, folder.id)
        .catch(err => console.error("Failed to send proposal email", err));
    }

    return this.mapCartOffer(offer);
  }

  async listFolderOffers(userId: string, folderId: string): Promise<CollectionCartOffer[]> {
    await this.assertOwnsFolder(userId, folderId);
    const offers = await this.prisma.collectionCartOffer.findMany({
      where: { folderId },
      include: {
        buyer: true,
        folder: { include: { user: true } },
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
        folder: { include: { user: true } },
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
          folder: { include: { user: true } },
          items: { include: { folderItem: { include: folderItemInclude } } },
        },
      });
      if (status === "ACCEPTED") {
        // Create Order
        await tx.order.create({
          data: {
            sellerId: offer.folder.userId,
            buyerId: offer.buyerId,
            status: "PENDING",
            totalAmountBrl: offer.totalOfferBrl,
            proposalId: offerId,
            items: {
              create: offer.items.map(item => ({
                name: item.folderItem.collectionItem.card.name,
                quantity: item.quantity,
                priceBrl: item.amountBrl,
                imageSmall: item.folderItem.collectionItem.card.imageSmall,
                condition: item.folderItem.collectionItem.condition,
                variant: item.folderItem.collectionItem.variant,
              }))
            }
          }
        });

        for (const offerItem of offer.items) {
          const folderItem = offerItem.folderItem;
          const soldQuantity = offerItem.quantity;
          const currentQuantity = folderItem.collectionItem.quantity;
          const totalSoldBefore = folderItem.soldQuantity;
          const totalSoldNow = totalSoldBefore + soldQuantity;

          await tx.collectionFolderItem.update({
            where: { id: offerItem.folderItemId },
            data: {
              isSold: totalSoldNow >= currentQuantity,
              soldQuantity: totalSoldNow,
              soldPriceBrl: offerItem.amountBrl,
              soldAt: new Date(),
              soldToUserId: offer.buyerId,
            },
          });

          if (totalSoldNow > currentQuantity) {
             // If for some reason we sold more than we had (shouldn't happen with validation),
             // we just decrement what's left.
          }
        }

        await tx.notification.create({
          data: {
            userId: offer.buyerId,
            title: "Proposta Aceita!",
            message: `Sua proposta na coleção "${offer.folder.name}" foi aceita pelo vendedor.`,
            link: `/profile?tab=proposals`,
          },
        });

        // Send decision email (Accepted)
        void this.emailService.sendProposalDecisionEmail(offer.buyer.email, offer.folder.user.name || offer.folder.user.email, offer.folder.name, "accepted")
          .catch(err => console.error("Failed to send accept email", err));

      } else if (status === "REJECTED") {
        await tx.notification.create({
          data: {
            userId: offer.buyerId,
            title: "Proposta Recusada",
            message: `Sua proposta na coleção "${offer.folder.name}" foi recusada pelo vendedor.`,
            link: `/profile?tab=proposals`,
          },
        });

        // Send decision email (Rejected)
        void this.emailService.sendProposalDecisionEmail(offer.buyer.email, offer.folder.user.name || offer.folder.user.email, offer.folder.name, "rejected")
          .catch(err => console.error("Failed to send reject email", err));
      }
      return decided;
    });

    return this.mapCartOffer(updated);
  }

  async getPublicFolder(
    shareToken: string,
    query: CollectionFolderQueryDto = {},
    viewerInfo?: { ip?: string; userAgent?: string; userId?: string; sid?: string },
  ): Promise<PublicCollectionDetail> {
    const accessConditions: Prisma.CollectionFolderWhereInput[] = [{ isPublic: true }];
    if (viewerInfo?.userId) {
      accessConditions.push({ userId: viewerInfo.userId });
      accessConditions.push({ permissions: { some: { userId: viewerInfo.userId } } });
    }

    const folder = await this.prisma.collectionFolder.findFirst({
      where: { 
        shareToken,
        OR: accessConditions,
      },
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
      const exists = await this.prisma.collectionFolder.findUnique({ where: { shareToken } });
      if (exists) {
        throw new UnauthorizedException("Esta coleção é privada e você não tem permissão para vê-la.");
      }
      throw new NotFoundException("Public collection not found");
    }

    if (viewerInfo && folder.userId !== viewerInfo.userId) {
      await this.recordView(folder.id, viewerInfo);
    }

    return {
      ...(await this.mapFolderDetail(folder, query.sort)),
      isPublic: folder.isPublic,
      ownerName: folder.user.name?.trim() || "Colecionador",
      viewCount: folder.viewCount,
    } as PublicCollectionDetail;
  }

  private async recordView(
    folderId: string,
    info: { ip?: string; userAgent?: string; userId?: string; sid?: string },
  ) {
    // 12h window is a good standard for "daily uniques"
    const window = new Date(Date.now() - 12 * 60 * 60 * 1000);

    const conditions: Prisma.CollectionViewWhereInput[] = [];
    if (info.userId) conditions.push({ viewerId: info.userId });
    if (info.sid) conditions.push({ userAgent: { contains: `sid:${info.sid}` } }); // Temporary hack to store sid in UA if model doesn't have it
    if (info.ip) conditions.push({ ip: info.ip });

    if (conditions.length === 0) return;

    const recentView = await this.prisma.collectionView.findFirst({
      where: {
        folderId,
        viewedAt: { gte: window },
        OR: conditions,
      },
    });

    if (!recentView) {
      await this.prisma.$transaction([
        this.prisma.collectionView.create({
          data: {
            folderId,
            viewerId: info.userId,
            ip: info.ip,
            userAgent: info.sid ? `${info.userAgent} sid:${info.sid}` : info.userAgent,
          },
        }),
        this.prisma.collectionFolder.update({
          where: { id: folderId },
          data: { viewCount: { increment: 1 } },
        }),
      ]);
    }
  }

  async getRanking(limit = 5, userId?: string): Promise<CollectionFolderSummary[]> {
    const accessConditions: Prisma.CollectionFolderWhereInput[] = [{ isPublic: true }];
    if (userId) {
      accessConditions.push({ permissions: { some: { userId } } });
    }

    const folders = await this.prisma.collectionFolder.findMany({
      where: { OR: accessConditions },
      include: {
        user: true,
        items: { include: folderItemInclude },
      },
      orderBy: { viewCount: "desc" },
      take: limit,
    });
    return Promise.all(folders.map((folder) => this.mapFolderSummary(folder as any)));
  }

  async searchMarket(query: string) {
    if (!query || query.length < 2) return { items: [], auctions: [] };

    const normalized = query.trim().toLowerCase();
    
    // Search public store items
    const storeItems = await this.prisma.collectionFolderItem.findMany({
      where: {
        folder: { isPublic: true, isStore: true },
        isSold: false,
        collectionItem: {
          card: {
            OR: [
              { name: { contains: normalized, mode: "insensitive" } },
              { number: { contains: normalized, mode: "insensitive" } },
            ],
          },
        },
      },
      include: {
        folder: { include: { user: true } },
        collectionItem: { include: collectionItemInclude },
      },
      take: 20,
    });

    // Search active auctions (since listActiveAuctions already exists, we filter here or query prisma)
    const auctions = await this.prisma.auction.findMany({
      where: {
        status: "OPEN",
        endsAt: { gt: new Date() },
        collectionItem: {
          card: {
            OR: [
              { name: { contains: normalized, mode: "insensitive" } },
              { number: { contains: normalized, mode: "insensitive" } },
            ],
          },
        },
      },
      include: auctionInclude,
      take: 20,
    }) as AuctionWithRelations[];

    return {
      items: storeItems.map(item => ({
        ...this.mapItem(item.collectionItem, item),
        folderId: item.folderId,
        folderName: item.folder.name,
        shareToken: item.folder.shareToken,
        sellerName: item.folder.user.name || item.folder.user.email,
      })),
      auctions: auctions.map(a => ({
        id: a.id,
        shareToken: a.shareToken,
        title: a.title,
        status: a.status.toLowerCase(),
        minBid: Number(a.minBidBrl),
        currentBid: a.bids && a.bids[0] ? Number(a.bids[0].amountBrl) : null,
        bidCount: 0, // Simplified for search
        endsAt: a.endsAt.toISOString(),
        card: toCardSummary(a.collectionItem.card),
        sellerName: a.seller.name || a.seller.email,
        sellerSlug: a.seller.profileSlug,
      })),
    };
  }

  async getExpansionProgress(userId: string) {
    const ownedItems = await this.prisma.collectionItem.findMany({
      where: { userId, card: { setId: { not: null } } },
      select: { card: { select: { setId: true, externalId: true } } },
    });

    const counts = new Map<string, Set<string>>();
    for (const item of ownedItems) {
      const setId = item.card.setId!;
      if (!counts.has(setId)) counts.set(setId, new Set());
      counts.get(setId)!.add(item.card.externalId);
    }

    const allSets = await this.catalog.listSets();
    return allSets
      .map((set) => {
        const owned = counts.get(set.id)?.size ?? 0;
        const total = set.printedTotal || set.total || 1;
        return {
          id: set.id,
          name: set.name,
          logoUrl: set.logoUrl,
          symbolUrl: set.symbolUrl,
          owned,
          total,
          percentage: Math.min(100, Math.round((owned / total) * 100)),
        };
      })
      .filter((p) => p.owned > 0)
      .sort((a, b) => b.percentage - a.percentage || a.name.localeCompare(b.name));
  }

  async getHomeSummary(userId: string) {
    const [recentProposals, ranking, expansionProgress] = await Promise.all([
      this.listMyProposals(userId),
      this.getRanking(5, userId),
      this.getExpansionProgress(userId),
    ]);

    return {
      recentProposals: recentProposals.slice(0, 5),
      ranking,
      expansionProgress: expansionProgress.slice(0, 5),
    };
  }

  async removeFolder(userId: string, id: string) {
    const folder = await this.assertOwnsFolder(userId, id);

    if (folder.bannerUrl) {
      await this.storage.deleteBanner(folder.bannerUrl);
    }

    await this.prisma.collectionFolder.delete({ where: { id } });
    return { ok: true };
  }

  async removeItemFromFolder(userId: string, folderId: string, folderItemId: string) {
    await this.assertOwnsFolder(userId, folderId);
    await this.prisma.collectionFolderItem.delete({
      where: { id: folderItemId, folderId },
    });
    return this.getFolder(userId, folderId);
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
        customPrice: dto.customPrice ?? null,
      },
      update: {
        quantity: { increment: dto.quantity ?? 1 },
        cardPriceId: existing?.cardPriceId ?? cardPriceId,
        notes: dto.notes ?? undefined,
        customPrice: dto.customPrice ?? undefined,
      },
      include: collectionItemInclude,
    });

    if (existing || (dto.quantity ?? 0) > 0) {
      await this.syncFolderItemsReplenishment(item.id, item.quantity);
    }

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
    const current = await this.prisma.collectionItem.findUnique({
      where: { id, userId },
      include: { card: true },
    });
    if (!current) {
      throw new NotFoundException("Collection item not found");
    }

    if (dto.variant) {
      this.assertValidVariant(current.card.variants, dto.variant);
    }

    const condition = dto.condition
      ? toPrismaCondition(dto.condition)
      : current.condition;
    const variant = dto.variant ?? current.variant;
    const foil = dto.foil ?? current.foil;
    const language = dto.language
      ? toPrismaLanguage(dto.language)
      : current.language;

    // Check if another item already exists with these attributes
    const existing = await this.prisma.collectionItem.findUnique({
      where: {
        userId_cardId_condition_variant_foil_language: {
          userId,
          cardId: current.cardId,
          condition,
          variant,
          foil,
          language,
        },
      },
    });

    if (existing && existing.id !== id) {
      const updatedExisting = await this.prisma.$transaction(async (tx) => {
        const item = await tx.collectionItem.update({
          where: { id: existing.id },
          data: {
            quantity: { increment: dto.quantity ?? current.quantity },
            notes: dto.notes ?? undefined,
            customPrice: dto.customPrice ?? undefined,
          },
          include: collectionItemInclude,
        });

        const currentFolderItems = await tx.collectionFolderItem.findMany({
          where: { collectionItemId: id },
        });

        for (const fi of currentFolderItems) {
          const alreadyInFolder = await tx.collectionFolderItem.findUnique({
            where: {
              folderId_collectionItemId: {
                folderId: fi.folderId,
                collectionItemId: existing.id,
              },
            },
          });

          if (!alreadyInFolder) {
            await tx.collectionFolderItem.update({
              where: { id: fi.id },
              data: { collectionItemId: existing.id },
            });
          } else {
            await tx.collectionFolderItem.delete({ where: { id: fi.id } });
          }
        }

        await tx.collectionItem.delete({ where: { id } });
        return item;
      });

      await this.syncFolderItemsReplenishment(
        updatedExisting.id,
        updatedExisting.quantity,
      );
      return this.mapItem(updatedExisting);
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
        customPrice: dto.customPrice,
      },
      include: collectionItemInclude,
    });

    if (
      dto.quantity !== undefined ||
      dto.variant !== undefined ||
      dto.condition !== undefined ||
      dto.foil !== undefined ||
      dto.language !== undefined
    ) {
      await this.syncFolderItemsReplenishment(item.id, item.quantity);
    }

    return this.mapItem(item);
  }

  private async syncFolderItemsReplenishment(collectionItemId: string, newQuantity: number) {
    const folderItems = await this.prisma.collectionFolderItem.findMany({
      where: { collectionItemId, isSold: true },
    });

    for (const fi of folderItems) {
      if (newQuantity > fi.soldQuantity) {
        await this.prisma.collectionFolderItem.update({
          where: { id: fi.id },
          data: { isSold: false },
        });
      }
    }
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
    return folder;
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
    const manualPrice = folderItem?.manualPriceBrl === null || folderItem?.manualPriceBrl === undefined
      ? null
      : Number(folderItem.manualPriceBrl);
    const catalogPrice = this.mapCardPrice(item.price);
    const customPrice = item.customPrice === null || item.customPrice === undefined
      ? null
      : Number(item.customPrice);

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
      customPrice,
      price: catalogPrice,
      store: folderItem ? {
        manualPrice,
        effectivePrice: manualPrice ?? customPrice ?? catalogPrice?.amount ?? null,
        isSold: folderItem.isSold,
        soldPrice: folderItem.soldPriceBrl === null ? null : Number(folderItem.soldPriceBrl),
        soldQuantity: folderItem.soldQuantity,
        soldAt: folderItem.soldAt?.toISOString() ?? null,
      } : null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  private async mapFolderSummary(
    folder: FolderWithItems & { user: { name: string | null; email: string } },
  ): Promise<CollectionFolderSummary> {
    const items = folder.items.map((entry) => entry.collectionItem);
    const totalValue = items.reduce(
      (sum, item) => {
        const itemPrice = item.customPrice !== null && item.customPrice !== undefined
          ? Number(item.customPrice)
          : (this.mapCardPrice(item.price)?.amount ?? 0);
        return sum + itemPrice * item.quantity;
      },
      0,
    );

    const previewItems = folder.items
      .slice(0, 4)
      .map((entry) => this.mapItem(entry.collectionItem, entry));

    return {
      id: folder.id,
      name: folder.name,
      userName: folder.user.name?.trim() || folder.user.email,
      isPublic: folder.isPublic,
      isStore: folder.isStore,
      shareToken: folder.shareToken,
      bannerUrl: folder.bannerUrl,
      viewCount: folder.viewCount,
      itemCount: folder.items.length,
      totalValue,
      previewItems,
      createdAt: folder.createdAt.toISOString(),
      updatedAt: folder.updatedAt.toISOString(),
    } as CollectionFolderSummary;
  }

  private async mapFolderDetail(
    folder: FolderWithItems,
    sort?: CollectionFolderSort,
  ): Promise<CollectionFolderDetail> {
    const items = folder.items.map((entry) => this.mapItem(entry.collectionItem, entry));
    const sortedItems = this.sortFolderItems(items, sort);
    const totalValue = items.reduce(
      (sum, item) => sum + (item.store?.effectivePrice ?? item.customPrice ?? item.price?.amount ?? 0) * item.quantity,
      0,
    );

    return {
      id: folder.id,
      name: folder.name,
      isPublic: folder.isPublic,
      isStore: folder.isStore,
      shareToken: folder.shareToken,
      bannerUrl: folder.bannerUrl,
      viewCount: folder.viewCount,
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
      folderName: offer.folder.name,
      buyerId: offer.buyerId,
      buyerName: offer.buyer.name?.trim() || offer.buyer.email,
      status: offer.status === "ACCEPTED" ? "accepted" : offer.status === "REJECTED" ? "rejected" : "pending",
      message: offer.message ?? undefined,
      totalOffer: Number(offer.totalOfferBrl),
      isGlobalOffer: offer.isGlobalOffer,
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

  async getPreviewImage(shareToken: string): Promise<Buffer> {
    const folder = await this.prisma.collectionFolder.findUnique({
      where: { shareToken },
      include: {
        items: {
          take: 8,
          orderBy: { createdAt: "desc" },
          include: {
            collectionItem: {
              include: {
                card: true,
              },
            },
          },
        },
      },
    });

    if (!folder) {
      throw new NotFoundException("Coleção não encontrada");
    }

    // Tentar carregar o banner primeiro
    if (folder.bannerUrl && !folder.bannerUrl.includes("preview-image")) {
      try {
        const baseUrl = this.config.get<string>("API_BASE_URL")?.replace(/\/$/, "");
        
        // Se for um banner local, tentar ler direto do disco
        if (baseUrl && folder.bannerUrl.startsWith(baseUrl)) {
          const filename = folder.bannerUrl.split("/").pop();
          if (filename) {
            const filePath = join(process.cwd(), "public", "banners", filename);
            const bannerBuffer = await fs.readFile(filePath);
            return this.toOgJpeg(bannerBuffer);
          }
        }

        // Se for externo
        const response = await fetch(folder.bannerUrl, {
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          return this.toOgJpeg(Buffer.from(arrayBuffer));
        }
      } catch (e: any) {
        console.error(`[Preview] Falha ao carregar banner: ${e.message}`);
      }
    }

    const width = 1200;
    const height = 630;

    const fallbackLogo = async (): Promise<Buffer> => {
      const possiblePaths = [
        join(process.cwd(), "public", "images", "logo-preview.png"),
        join(process.cwd(), "apps", "api", "public", "images", "logo-preview.png"),
      ];

      let logoBuffer: Buffer | null = null;
      for (const path of possiblePaths) {
        try {
          logoBuffer = await fs.readFile(path);
          break;
        } catch {}
      }

      if (logoBuffer) {
        try {
          const generated = await sharp({
            create: {
              width,
              height,
              channels: 4,
              background: { r: 17, g: 24, b: 39, alpha: 1 },
            },
          })
            .composite([
              {
                input: await sharp(logoBuffer)
                  .resize({
                    width: 600,
                    height: 400,
                    fit: "inside",
                    withoutEnlargement: true,
                  })
                  .toBuffer(),
                gravity: "center",
              },
            ])
            .png()
            .toBuffer();

          return this.toOgJpeg(generated);
        } catch (e: any) {
          console.error(`[Preview] Erro ao processar logo: ${e.message}`);
        }
      }

      const generated = await sharp({
        create: {
          width,
          height,
          channels: 4,
          background: { r: 31, g: 41, b: 55, alpha: 1 },
        },
      })
        .png()
        .toBuffer();

      return this.toOgJpeg(generated);
    };

    const cardCount = folder.items.length;
    if (cardCount === 0) return fallbackLogo();

    const images = await Promise.all(
      folder.items.map(async (item) => {
        const url = item.collectionItem?.card?.imageSmall;
        if (!url) return null;
        try {
          const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
          if (!response.ok) return null;
          return Buffer.from(await response.arrayBuffer());
        } catch { return null; }
      }),
    );

    const hasMore = cardCount > 4;
    const composites: sharp.OverlayOptions[] = [];
    const cardWidth = 240;
    const cardHeight = 335;
    const gap = 40;

    const row1Top = hasMore ? 60 : (height - cardHeight) / 2;
    const row2Top = row1Top + cardHeight + gap;

    const placeholder = await sharp({
      create: {
        width: cardWidth,
        height: cardHeight,
        channels: 4,
        background: { r: 31, g: 41, b: 55, alpha: 0.5 },
      },
    })
      .composite([{
        input: Buffer.from(`
          <svg width="${cardWidth}" height="${cardHeight}">
            <rect x="2" y="2" width="${cardWidth - 4}" height="${cardHeight - 4}" rx="18" fill="none" stroke="#374151" stroke-width="4" stroke-dasharray="12,12" />
          </svg>
        `),
        top: 0,
        left: 0,
      }])
      .png()
      .toBuffer();

    const rowCount = hasMore ? 2 : 1;
    const cardsPerRow = 4;

    for (let r = 0; r < rowCount; r++) {
      const cardsInThisRow = hasMore ? cardsPerRow : cardCount;
      const totalWidth = cardsInThisRow * cardWidth + (cardsInThisRow - 1) * gap;
      const startX = (width - totalWidth) / 2;
      const top = r === 0 ? row1Top : row2Top;

      for (let c = 0; c < cardsInThisRow; c++) {
        const index = r * cardsPerRow + c;
        const left = Math.round(startX + c * (cardWidth + gap));

        let cardBuffer: Buffer | null = null;
        let displayId: string | null = null;

        if (index < cardCount) {
          const item = folder.items[index];
          const cardNumber = item?.collectionItem?.card?.number ?? "";
          const printedTotal = item?.collectionItem?.card?.printedTotal;
          displayId = printedTotal ? `${cardNumber}/${printedTotal}` : cardNumber;

          if (images[index]) {
            cardBuffer = await sharp(images[index] as Buffer)
              .rotate()
              .resize(cardWidth, cardHeight, { fit: "cover", position: "center" })
              .jpeg({ quality: 90 })
              .toBuffer();
          }
        }

        // Draw card or placeholder
        composites.push({
          input: cardBuffer || placeholder,
          top,
          left,
        });

        // Badge only for first row
        if (displayId && r === 0) {
          const badgeWidth = 210;
          const badgeHeight = 66;
          const svgBadge = `
            <svg width="${badgeWidth}" height="${badgeHeight}">
              <rect x="2" y="2" width="${badgeWidth - 4}" height="${badgeHeight - 4}" rx="18" fill="white" stroke="#e2e8f0" stroke-width="2" />
              <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="30" fill="black">${displayId}</text>
            </svg>
          `;

          composites.push({
            input: Buffer.from(svgBadge),
            top: top + cardHeight - (badgeHeight / 2) - 10,
            left: left + (cardWidth / 2) - (badgeWidth / 2),
          });
        }
      }
    }

    const generated = await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 17, g: 24, b: 39, alpha: 1 },
      },
    })
      .composite(composites)
      .png()
      .toBuffer();

    return this.toOgJpeg(generated);
  }

  async getShareHtml(shareToken: string): Promise<string> {
    const folder = await this.prisma.collectionFolder.findUnique({
      where: { shareToken },
      include: { user: true },
    });

    if (!folder) throw new NotFoundException();

    const baseUrl = this.config.getOrThrow<string>("API_BASE_URL").replace(/\/$/, "");
    const frontUrl = this.config.getOrThrow<string>("FRONT_URL").replace(/\/$/, "");

    // Usar o formato curto para a URL de compartilhamento no OG
    const redirectUrl = `${frontUrl}/p/${shareToken}`;
    const version = folder.updatedAt.getTime();
    const imageUrl = `${baseUrl}/public/collections/${shareToken}/preview-image?v=${version}`;

    const title = this.escapeHtml(
      `${folder.name} - Coleção de ${folder.user.name?.trim() || "um colecionador"}`,
    );

    const description = this.escapeHtml(
      "Confira minha coleção de cartas Pokémon no Coleciona Card!",
    );

    return `
  <!DOCTYPE html>
  <html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <title>${title}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <meta property="og:type" content="website" />
    <meta property="og:url" content="${redirectUrl}" />
    <meta property="og:site_name" content="Coleciona Card" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:image:secure_url" content="${imageUrl}" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="${redirectUrl}" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${imageUrl}" />

    <meta http-equiv="refresh" content="1;url=${redirectUrl}" />
  </head>
  <body style="background:#111827;color:white;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
    <div style="text-align:center;">
      <p>Redirecionando para a coleção...</p>
      <a href="${redirectUrl}" style="color:#3b82f6;">Abrir coleção</a>
    </div>

    <script>
      setTimeout(function () {
        window.location.href = "${redirectUrl}";
      }, 800);
    </script>
  </body>
  </html>`;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  private async toOgJpeg(buffer: Buffer): Promise<Buffer> {
    const width = 1200;
    const height = 630;
    const maxBytes = 250 * 1024;

    const resized = await sharp(buffer)
      .rotate()
      .resize(width, height, { fit: "cover", position: "center" })
      .flatten({ background: { r: 17, g: 24, b: 39 } })
      .toBuffer();

    for (const quality of [82, 75, 68, 60, 52, 45, 38]) {
      const output = await sharp(resized)
        .jpeg({ quality, mozjpeg: true, progressive: true })
        .toBuffer();

      if (output.length <= maxBytes) return output;
    }

    return sharp(resized).jpeg({ quality: 30, mozjpeg: true, progressive: true }).toBuffer();
  }
}

function normalizeCardNumber(number: string): string {
  return number.trim().replace(/^0+(?=\d)/, "");
}

function latestPriceChange(item: CollectionItem): number {
  if (item.customPrice !== null && item.customPrice !== undefined) {
    return 0;
  }
  const history = item.price?.history ?? [];
  const latest = history[history.length - 1];
  return latest ? latest.amount - latest.previousAmount : 0;
}
