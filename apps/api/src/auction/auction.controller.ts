import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequestUser } from "../common/current-user.decorator";
import { JwtAuthGuard, OptionalJwtAuthGuard } from "../common/jwt-auth.guard";
import { AuctionService } from "./auction.service";
import { CreateAuctionDto, PlaceAuctionBidDto } from "./dto";

@ApiTags("auctions")
@Controller("auctions")
export class AuctionController {
  constructor(private readonly auction: AuctionService) {}

  @Get()
  listActive() {
    return this.auction.listActive();
  }

  @Get(":idOrToken")
  @UseGuards(OptionalJwtAuthGuard)
  getById(@Param("idOrToken") idOrToken: string) {
    return this.auction.getById(idOrToken);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateAuctionDto) {
    return this.auction.create(user.id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(":id/bids")
  placeBid(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: PlaceAuctionBidDto
  ) {
    return this.auction.placeBid(user.id, id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(":id/close")
  close(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.auction.close(user.id, id);
  }
}
