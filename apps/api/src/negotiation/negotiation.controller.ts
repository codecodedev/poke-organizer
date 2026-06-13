import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/current-user.decorator";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import {
  CounterNegotiationDto,
  CreateNegotiationMessageDto,
  DecideProposalNegotiationDto,
  ListNegotiationsQueryDto,
  RespondCounterNegotiationDto,
  UpdateNegotiationOrderStatusDto,
} from "./dto";
import { NegotiationService } from "./negotiation.service";

@ApiTags("Negotiations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("negotiations")
export class NegotiationController {
  constructor(private readonly negotiationService: NegotiationService) {}

  @Get()
  list(@CurrentUser("id") userId: string, @Query() query: ListNegotiationsQueryDto) {
    return this.negotiationService.list(userId, query);
  }

  @Get("proposal/:offerId")
  getProposal(@CurrentUser("id") userId: string, @Param("offerId") offerId: string) {
    return this.negotiationService.getProposal(userId, offerId);
  }

  @Get("auction/:orderId")
  getAuction(@CurrentUser("id") userId: string, @Param("orderId") orderId: string) {
    return this.negotiationService.getAuctionOrder(userId, orderId);
  }

  @Get("order/:orderId")
  getByOrder(@CurrentUser("id") userId: string, @Param("orderId") orderId: string) {
    return this.negotiationService.getByOrder(userId, orderId);
  }

  @Post("proposal/:offerId/messages")
  addProposalMessage(
    @CurrentUser("id") userId: string,
    @Param("offerId") offerId: string,
    @Body() dto: CreateNegotiationMessageDto,
  ) {
    return this.negotiationService.addProposalMessage(userId, offerId, dto.message);
  }

  @Post("auction/:orderId/messages")
  addAuctionMessage(
    @CurrentUser("id") userId: string,
    @Param("orderId") orderId: string,
    @Body() dto: CreateNegotiationMessageDto,
  ) {
    return this.negotiationService.addAuctionMessage(userId, orderId, dto.message);
  }

  @Post("proposal/:offerId/counter")
  counterProposal(
    @CurrentUser("id") userId: string,
    @Param("offerId") offerId: string,
    @Body() dto: CounterNegotiationDto,
  ) {
    return this.negotiationService.counterProposal(userId, offerId, dto.totalOffer, dto.message);
  }

  @Post("proposal/:offerId/respond-counter")
  respondCounterProposal(
    @CurrentUser("id") userId: string,
    @Param("offerId") offerId: string,
    @Body() dto: RespondCounterNegotiationDto,
  ) {
    return this.negotiationService.respondCounterProposal(userId, offerId, dto.status, dto.message);
  }

  @Post("proposal/:offerId/decide")
  decideProposal(
    @CurrentUser("id") userId: string,
    @Param("offerId") offerId: string,
    @Body() dto: DecideProposalNegotiationDto,
  ) {
    return this.negotiationService.decideProposal(userId, offerId, dto.status);
  }

  @Post("proposal/:offerId/items/:itemId/delete")
  removeItemFromProposal(
    @CurrentUser("id") userId: string,
    @Param("offerId") offerId: string,
    @Param("itemId") itemId: string,
  ) {
    return this.negotiationService.removeItemFromProposal(userId, offerId, itemId);
  }

  @Post(":origin/:id/order-status")
  updateOrderStatus(
    @CurrentUser("id") userId: string,
    @Param("origin") origin: string,
    @Param("id") id: string,
    @Body() dto: UpdateNegotiationOrderStatusDto,
  ) {
    return this.negotiationService.updateOrderStatus(userId, origin, id, dto.status);
  }
}
