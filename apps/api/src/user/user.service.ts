import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { UserPublicProfile, AuctionStatus } from "@poke-organizer/shared";
import { PrismaService } from "../prisma/prisma.service";
import { toCardSummary } from "../common/mappers";
import { UpdateProfileDto } from "./dto";

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicProfile(slug: string): Promise<UserPublicProfile> {
    const user = await this.prisma.user.findUnique({
      where: { profileSlug: slug },
      include: {
        folders: {
          where: { isPublic: true },
          include: { items: { include: { collectionItem: { include: { card: true, price: true } } } } }
        },
        auctions: {
          where: { status: "OPEN" },
          include: {
            collectionItem: { include: { card: true, price: true } },
            bids: true,
            seller: true
          }
        }
      }
    });

    if (!user || !user.isPublicProfile) {
      throw new NotFoundException("Perfil não encontrado ou privado");
    }

    const viewing = user.folders.filter(f => !f.isStore).map(f => this.mapFolder(f));
    const selling = user.folders.filter(f => f.isStore).map(f => this.mapFolder(f));

    return {
      id: user.id,
      name: user.name || "Colecionador",
      slug: user.profileSlug,
      bio: user.profileBio,
      avatarUrl: null, // To be implemented
      collections: { viewing, selling },
      auctions: user.auctions.map(a => ({
        id: a.id,
        sellerId: a.sellerId,
        sellerName: a.seller.name || a.seller.email,
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
      }))
    };
  }

  async checkSlug(slug: string): Promise<{ available: boolean }> {
    const existing = await this.prisma.user.findUnique({
      where: { profileSlug: slug },
      select: { id: true }
    });
    return { available: !existing };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (dto.profileSlug) {
      const existing = await this.prisma.user.findFirst({
        where: { profileSlug: dto.profileSlug, id: { not: userId } }
      });
      if (existing) throw new BadRequestException("Este link de perfil já está em uso");
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        name: dto.name,
        profileSlug: dto.profileSlug,
        profileBio: dto.profileBio,
        isPublicProfile: dto.isPublicProfile
      }
    });
  }

  private mapFolder(f: any) {
    const totalValue = f.items.reduce((sum: number, item: any) => {
        const price = item.collectionItem.customPrice !== null && item.collectionItem.customPrice !== undefined
          ? Number(item.collectionItem.customPrice)
          : (Number(item.collectionItem.price?.amountBrl) || 0);
        return sum + price * item.collectionItem.quantity;
    }, 0);

    return {
      id: f.id,
      name: f.name,
      isPublic: f.isPublic,
      isStore: f.isStore,
      shareToken: f.shareToken,
      viewCount: f.viewCount,
      itemCount: f.items.length,
      totalValue,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
    };
  }
}
