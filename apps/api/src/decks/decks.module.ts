import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { DecksController } from "./decks.controller";
import { DecksService } from "./decks.service";
import { JwtModule } from "@nestjs/jwt";

@Module({
  imports: [PrismaModule,JwtModule.register({})],
  controllers: [DecksController],
  providers: [DecksService]
})
export class DecksModule {}
