import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuctionDetail, AuctionSummary, AuctionStatus } from "@poke-organizer/shared";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { toCardSummary } from "../common/mappers";
import { CreateAuctionDto, PlaceAuctionBidDto } from "./dto";
import { EmailService } from "../email/email.service";

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService
  ) {}

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

  async listByUser(userId: string): Promise<AuctionSummary[]> {
    const auctions = await this.prisma.auction.findMany({
      where: { sellerId: userId },
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
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.whatsapp) {
      throw new BadRequestException("Você precisa cadastrar um número de WhatsApp no seu perfil para dar lances.");
    }

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
          link: `/auctions/${auction.shareToken}`,
        },
      }),
    ]);

    // Send email notification
    const seller = await this.prisma.user.findUnique({ where: { id: auction.sellerId } });
    if (seller) {
      void this.emailService.sendNewBidEmail(seller.email, auction.title || "Carta Pokémon", dto.amountBrl, auction.shareToken)
        .catch(err => console.error("Failed to send bid email", err));
    }

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

  async selectWinner(userId: string, id: string, bidId: string): Promise<AuctionDetail> {
    const auction = await this.prisma.auction.findFirst({
      where: { id, sellerId: userId },
      include: { bids: true, collectionItem: { include: { card: true } } },
    });

    if (!auction) throw new NotFoundException("Leilão não encontrado");
    
    const bid = auction.bids.find(b => b.id === bidId);
    if (!bid) throw new NotFoundException("Lance não encontrado");

    const updated = await this.prisma.$transaction(async (tx) => {
      const auctionUpdated = await tx.auction.update({
        where: { id },
        data: { 
          winningBidId: bidId,
          status: "CLOSED" 
        },
        include: auctionInclude,
      });

      // Create Order
      await tx.order.create({
        data: {
          sellerId: userId,
          buyerId: bid.bidderId,
          status: "PENDING",
          totalAmountBrl: bid.amountBrl,
          auctionId: id,
          items: {
            create: {
              name: auction.collectionItem.card.name,
              quantity: 1,
              priceBrl: bid.amountBrl,
              imageSmall: auction.collectionItem.card.imageSmall,
              condition: auction.collectionItem.condition,
              variant: auction.collectionItem.variant,
              cardNumber: auction.collectionItem.card.number,
              cardTotal: auction.collectionItem.card.printedTotal,
              }

          }
        }
      });

      return auctionUpdated;
    });

    // Notify winner
    const bidder = await this.prisma.user.findUnique({ where: { id: bid.bidderId } });
    if (bidder) {
      await this.prisma.notification.create({
        data: {
          userId: bid.bidderId,
          title: "Seu lance venceu!",
          message: `Parabéns! Seu lance de R$ ${Number(bid.amountBrl).toFixed(2)} no leilão "${auction.title || 'Carta Pokémon'}" foi o vencedor.`,
          link: `/orders?tab=purchases`,
        },
      });

      void this.emailService.sendAuctionWinnerEmail(
        bidder.email, 
        updated.seller.name || updated.seller.email, 
        auction.title || "Leilão de Carta", 
        Number(bid.amountBrl)
      ).catch(err => console.error("Failed to send bid winner email", err));
    }

    return this.mapDetail(updated);
  }

  async deleteBid(userId: string, id: string, bidId: string): Promise<AuctionDetail> {
    const auction = await this.prisma.auction.findFirst({
      where: { id, sellerId: userId },
    });

    if (!auction) throw new NotFoundException("Leilão não encontrado");

    const bid = await this.prisma.auctionBid.findFirst({
      where: { id: bidId, auctionId: id }
    });

    if (!bid) throw new NotFoundException("Lance não encontrado");

    await this.prisma.auctionBid.delete({ where: { id: bidId } });

    // Recalculate current bid
    const highestBid = await this.prisma.auctionBid.findFirst({
      where: { auctionId: id },
      orderBy: { amountBrl: "desc" }
    });

    await this.prisma.auction.update({
      where: { id },
      data: { currentBidBrl: highestBid ? highestBid.amountBrl : null }
    });

    return this.getById(id);
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
      winningBidId: a.winningBidId,
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
