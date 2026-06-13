import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AddressValidationService } from "../common/address-validation.service";

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, AddressValidationService],
  exports: [AuthService, JwtModule]
})
export class AuthModule {}
