import { ConflictException, Injectable, UnauthorizedException, BadRequestException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { User } from "@prisma/client";
import { LEGAL_PRIVACY_VERSION, LEGAL_TERMS_VERSION } from "@poke-organizer/shared";
import * as argon2 from "argon2";
import * as randomstring from "randomstring";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { AddressValidationService } from "../common/address-validation.service";
import { LoginDto, RegisterDto, RequestPasswordResetDto, ResetPasswordDto, ConfirmEmailDto, RequestEmailConfirmationDto } from "./dto";

type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

type RegisterContext = {
  ip?: string;
  userAgent?: string | string[];
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
    private readonly addressValidation: AddressValidationService
  ) {}

  async register(dto: RegisterDto, context: RegisterContext = {}) {
    if (!dto.acceptTerms || !dto.acceptPrivacy) {
      throw new BadRequestException("É necessário aceitar os Termos de Uso e a Política de Privacidade.");
    }

    const email = dto.email.toLowerCase().trim();

    // Validate city/state
    const isCityValid = await this.addressValidation.validateCity(dto.state, dto.city);
    if (!isCityValid) {
      throw new BadRequestException(`A cidade "${dto.city}" não foi encontrada no estado ${dto.state}.`);
    }
    
    // Check if user or identity already exists
    const existing = await this.prisma.user.findFirst({ 
      where: { 
        OR: [
          { email },
          { identities: { some: { provider: "password", providerUserId: email } } }
        ]
      } 
    });

    if (existing) {
      throw new ConflictException("E-mail já cadastrado");
    }

    const emailConfirmationToken = randomstring.generate(32);

    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          name: dto.name.trim(),
          state: dto.state,
          city: dto.city.trim(),
          passwordHash: await argon2.hash(dto.password),
          emailConfirmationToken,
          emailConfirmationSentAt: new Date(),
          termsAcceptedAt: new Date(),
          termsVersion: LEGAL_TERMS_VERSION,
          privacyAcceptedAt: new Date(),
          privacyVersion: LEGAL_PRIVACY_VERSION,
          legalAcceptedIp: context.ip || null,
          legalAcceptedUserAgent: Array.isArray(context.userAgent)
            ? context.userAgent.join(", ")
            : context.userAgent || null,
          identities: {
            create: {
              provider: "password",
              providerUserId: email
            }
          }
        }
      });

      // Send welcome email asynchronously
      void this.emailService.sendWelcomeEmail(user.email, user.name || "Treinador", emailConfirmationToken)
        .catch(err => console.error("Failed to send welcome email", err));

      return { 
        message: "Cadastro realizado com sucesso. Por favor, verifique seu e-mail para confirmar sua conta." 
      };
    } catch (error: any) {
      // Handle Prisma unique constraint violation (P2002)
      if (error.code === "P2002") {
        throw new ConflictException("E-mail já está em uso");
      }
      throw error;
    }
  }

  async requestEmailConfirmation(dto: RequestEmailConfirmationDto) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Don't leak user existence
      return { message: "Se o e-mail estiver cadastrado e não confirmado, um novo link será enviado." };
    }

    if (user.emailConfirmedAt) {
      throw new BadRequestException("Este e-mail já foi confirmado. Por favor, faça login.");
    }

    // Cooldown check (1 minute)
    if (user.emailConfirmationSentAt && Date.now() - user.emailConfirmationSentAt.getTime() < 60 * 1000) {
      const remaining = Math.ceil((60 * 1000 - (Date.now() - user.emailConfirmationSentAt.getTime())) / 1000);
      throw new BadRequestException(`Aguarde ${remaining} segundos para solicitar um novo e-mail.`);
    }

    const emailConfirmationToken = randomstring.generate(32);
    
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailConfirmationToken,
        emailConfirmationSentAt: new Date(),
      }
    });

    // Send email asynchronously
    void this.emailService.sendWelcomeEmail(user.email, user.name || "Treinador", emailConfirmationToken)
      .catch(err => console.error("Failed to resend welcome email", err));

    return { message: "Um novo link de confirmação foi enviado para o seu e-mail." };
  }

  async confirmEmail(dto: ConfirmEmailDto) {
    const user = await this.prisma.user.findUnique({
      where: { emailConfirmationToken: dto.token }
    });

    if (!user) {
      throw new BadRequestException("Invalid or expired confirmation token");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailConfirmedAt: new Date(),
        emailConfirmationToken: null
      }
    });

    return { ok: true };
  }

  async requestPasswordReset(dto: RequestPasswordResetDto) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });

    // We don't want to leak if the email exists or not
    if (!user) {
      return { message: "Se o e-mail estiver cadastrado, um link de recuperação será enviado." };
    }

    // Cooldown check (1 minute)
    // passwordResetExpiresAt is set to 1 hour from request. 
    // If it's more than 59 minutes from now, it was sent less than a minute ago.
    if (user.passwordResetExpiresAt && (user.passwordResetExpiresAt.getTime() - Date.now() > 59 * 60 * 1000)) {
      const remaining = Math.ceil((user.passwordResetExpiresAt.getTime() - 59 * 60 * 1000 - Date.now()) / 1000);
      throw new BadRequestException(`Aguarde ${remaining} segundos para solicitar uma nova recuperação.`);
    }

    const passwordResetToken = randomstring.generate(32);
    const passwordResetExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken,
        passwordResetExpiresAt
      }
    });

    // Send email asynchronously
    void this.emailService.sendPasswordResetEmail(user.email, passwordResetToken)
      .catch(err => console.error("Failed to send password reset email", err));

    return { message: "Um link de recuperação foi enviado para o seu e-mail." };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { passwordResetToken: dto.token }
    });

    if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
      throw new BadRequestException("Invalid or expired reset token");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await argon2.hash(dto.password),
        passwordResetToken: null,
        passwordResetExpiresAt: null
      }
    });

    return { ok: true };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase().trim() } });
    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException("E-mail ou senha inválidos");
    }

    if (!user.emailConfirmedAt) {
      throw new UnauthorizedException("Por favor, confirme seu e-mail antes de entrar.");
    }

    return this.buildAuthResponse(user);
  }

  async refresh(refreshToken: string) {
    const payload = await this.jwtService.verifyAsync<{ sub: string; email: string; jti: string }>(refreshToken, {
      secret: this.config.get<string>("JWT_REFRESH_SECRET")
    });

    const stored = await this.prisma.refreshToken.findUnique({ where: { id: payload.jti }, include: { user: true } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (!(await argon2.verify(stored.tokenHash, refreshToken))) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() }
    });

    return this.buildAuthResponse(stored.user);
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
    return { ok: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        profileSlug: true,
        profileBio: true,
        isPublicProfile: true,
        whatsapp: true,
        state: true,
        city: true,
        createdAt: true
      }
    });
    return user;
  }

  private async buildAuthResponse(user: User) {
    const tokens = await this.issueTokens(user);
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        profileSlug: user.profileSlug,
        profileBio: user.profileBio,
        isPublicProfile: user.isPublicProfile,
        whatsapp: user.whatsapp,
        state: user.state,
        city: user.city
      },
      ...tokens
    };
  }

  private async issueTokens(user: User): Promise<TokenPair> {
    const refresh = await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: "pending",
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });

    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, email: user.email },
      {
        secret: this.config.get<string>("JWT_ACCESS_SECRET"),
        expiresIn: this.config.get<string>("JWT_ACCESS_TTL") ?? "15m"
      }
    );
    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, email: user.email, jti: refresh.id },
      {
        secret: this.config.get<string>("JWT_REFRESH_SECRET"),
        expiresIn: this.config.get<string>("JWT_REFRESH_TTL") ?? "30d"
      }
    );

    await this.prisma.refreshToken.update({
      where: { id: refresh.id },
      data: { tokenHash: await argon2.hash(refreshToken) }
    });

    return { accessToken, refreshToken };
  }

  async verifyPassword(userId: string, password: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return false;
    return argon2.verify(user.passwordHash, password);
  }
}
