import { ConflictException, Injectable, UnauthorizedException, BadRequestException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { User } from "@prisma/client";
import * as argon2 from "argon2";
import * as randomstring from "randomstring";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { LoginDto, RegisterDto, RequestPasswordResetDto, ResetPasswordDto, ConfirmEmailDto } from "./dto";

type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException("Email already registered");
    }

    const emailConfirmationToken = randomstring.generate(32);

    const user = await this.prisma.user.create({
      data: {
        email,
        name: dto.name?.trim() || null,
        passwordHash: await argon2.hash(dto.password),
        emailConfirmationToken,
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
      message: "Registration successful. Please check your email to confirm your account." 
    };
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
      return { ok: true };
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

    return { ok: true };
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
      throw new UnauthorizedException("Invalid credentials");
    }

    if (!user.emailConfirmedAt) {
      throw new UnauthorizedException("Please confirm your email before logging in");
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
        isPublicProfile: user.isPublicProfile
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
