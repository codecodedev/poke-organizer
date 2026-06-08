import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuctionDetail, AuctionSummary, AuctionStatus } from "@poke-organizer/shared";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { toCardSummary } from "../common/mappers";
import { CreateAuctionDto, PlaceAuctionBidDto } from "./dto";

const auctionInclude = {
  seller: true,
  collectionItem: {
    include: {
      card: true,
      price: true,
    },
  },
  bids: {
    include: { bidder: true },
    orderBy: { createdAt: "desc" as const },
  },
} satisfies Prisma.AuctionInclude;

type AuctionWithRelations = Prisma.AuctionGetPayload<{
  include: typeof auctionInclude;
}>;

@Injectable()
export class AuctionService {
  constructor(private readonly prisma: PrismaService) {}

  async listActive(): Promise<AuctionSummary[]> {
    const auctions = await this.prisma.auction.findMany({
      where: {
        status: "OPEN",
        endsAt: { gte: new Date() },
      },
      include: auctionInclude,
      orderBy: { createdAt: "desc" },
    });
    return auctions.map((a) => this.mapSummary(a));
  }

  async getById(idOrToken: string): Promise<AuctionDetail> {
    const auction = await this.prisma.auction.findFirst({
      where: {
        OR: [{ id: idOrToken }, { shareToken: idOrToken }],
      },
      include: auctionInclude,
    });
    if (!auction) throw new NotFoundException("Leilão não encontrado");
    return this.mapDetail(auction);
  }

  async create(userId: string, dto: CreateAuctionDto): Promise<AuctionDetail> {
    const item = await this.prisma.collectionItem.findFirst({
      where: { id: dto.collectionItemId, userId },
    });
    if (!item) throw new NotFoundException("Carta não encontrada na sua coleção");

    const auction = await this.prisma.auction.create({
      data: {
        sellerId: userId,
        collectionItemId: dto.collectionItemId,
        title: dto.title,
        description: dto.description,
        minBidBrl: dto.minBidBrl,
        endsAt: new Date(dto.endsAt),
        status: "OPEN",
      },
      include: auctionInclude,
    });

    return this.mapDetail(auction);
  }

  async placeBid(userId: string, id: string, dto: PlaceAuctionBidDto): Promise<AuctionDetail> {
    const auction = await this.prisma.auction.findUnique({
      where: { id },
      include: { bids: { take: 1, orderBy: { amountBrl: "desc" } } },
    });

    if (!auction) throw new NotFoundException("Leilão não encontrado");
    if (auction.status !== "OPEN" || auction.endsAt < new Date()) {
      throw new BadRequestException("Este leilão já foi encerrado");
    }
    if (auction.sellerId === userId) {
      throw new BadRequestException("Você não pode dar lances no seu próprio leilão");
    }

    const minAmount = auction.bids[0] 
      ? Number(auction.bids[0].amountBrl) + 0.01 
      : Number(auction.minBidBrl);

    if (dto.amountBrl < minAmount) {
      throw new BadRequestException(`O lance mínimo é R$ ${minAmount.toFixed(2)}`);
    }

    await this.prisma.$transaction([
      this.prisma.auctionBid.create({
        data: {
          auctionId: id,
          bidderId: userId,
          amountBrl: dto.amountBrl,
        },
      }),
      this.prisma.auction.update({
        where: { id },
        data: { currentBidBrl: dto.amountBrl },
      }),
      this.prisma.notification.create({
        data: {
          userId: auction.sellerId,
          title: "Novo Lance no Leilão!",
          message: `O seu leilão recebeu um novo lance de R$ ${dto.amountBrl.toFixed(2)}.`,
          link: `/profile?tab=auctions`,
        },
      }),
    ]);

    return this.getById(id);
  }

  async close(userId: string, id: string): Promise<AuctionDetail> {
    const auction = await this.prisma.auction.findFirst({
      where: { id, sellerId: userId },
    });
    if (!auction) throw new NotFoundException("Leilão não encontrado");

    const updated = await this.prisma.auction.update({
      where: { id },
      data: { status: "CLOSED" },
      include: auctionInclude,
    });

    return this.mapDetail(updated);
  }

  private mapSummary(a: AuctionWithRelations): AuctionSummary {
    return {
      id: a.id,
      sellerId: a.sellerId,
      sellerName: a.seller.name || a.seller.email,
      sellerSlug: a.seller.profileSlug,
      card: toCardSummary(a.collectionItem.card),
      collectionItem: {
          id: a.collectionItem.id,
          card: toCardSummary(a.collectionItem.card),
          quantity: a.collectionItem.quantity,
          condition: a.collectionItem.condition as any,
          variant: a.collectionItem.variant,
          foil: a.collectionItem.foil,
          language: a.collectionItem.language as any,
          createdAt: a.collectionItem.createdAt.toISOString(),
          updatedAt: a.collectionItem.updatedAt.toISOString(),
      },
      title: a.title,
      description: a.description,
      minBid: Number(a.minBidBrl),
      currentBid: a.currentBidBrl ? Number(a.currentBidBrl) : null,
      endsAt: a.endsAt.toISOString(),
      status: a.status.toLowerCase() as AuctionStatus,
      shareToken: a.shareToken,
      bidCount: a.bids.length,
      createdAt: a.createdAt.toISOString(),
    };
  }

  private mapDetail(a: AuctionWithRelations): AuctionDetail {
    return {
      ...this.mapSummary(a),
      bids: a.bids.map((b) => ({
        id: b.id,
        auctionId: b.auctionId,
        bidderId: b.bidderId,
        bidderName: b.bidder.name || b.bidder.email,
        amount: Number(b.amountBrl),
        createdAt: b.createdAt.toISOString(),
      })),
    };
  }
}
