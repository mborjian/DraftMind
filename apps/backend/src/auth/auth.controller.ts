import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentSession } from '../common/decorators/current-session.decorator';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';
import type { AuthenticatedSession } from '../common/interfaces/authenticated-session.interface';
import { SessionsService } from '../sessions/sessions.service';
import { LoginPasswordDto } from './dto/login-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionsService: SessionsService,
  ) {}

  @Post('login/password')
  async loginWithPassword(@Body() dto: LoginPasswordDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.loginWithPassword(dto.password);
    this.applySessionCookie(response, result.sessionToken, result.expiresAt);
    return { success: true, sessionToken: result.sessionToken, expiresAt: result.expiresAt };
  }

  @Post('login/request-otp')
  requestOtp() {
    return this.authService.requestOtp();
  }

  @Post('login/verify-otp')
  verifyOtp(@Body() dto: VerifyOtpDto, @Res({ passthrough: true }) response: Response) {
    const result = this.authService.verifyOtp(dto.code);
    this.applySessionCookie(response, result.sessionToken, result.expiresAt);
    return { success: true, sessionToken: result.sessionToken, expiresAt: result.expiresAt };
  }

  @Post('logout')
  @UseGuards(SessionAuthGuard)
  logout(
    @CurrentSession() session: AuthenticatedSession,
    @Res({ passthrough: true }) response: Response,
  ) {
    const cookieName = this.sessionsService.getCookieName();
    this.authService.logout(session.tokenHash);
    response.clearCookie(cookieName);
    return { success: true };
  }

  @Get('session')
  @UseGuards(SessionAuthGuard)
  getSession(@CurrentSession() session: AuthenticatedSession) {
    return {
      success: true,
      data: {
        sessionId: session.sessionId,
        expiresAt: session.expiresAt,
        lastSeenAt: session.lastSeenAt,
      },
    };
  }

  private applySessionCookie(response: Response, token: string, expiresAt: string): void {
    response.cookie(this.sessionsService.getCookieName(), token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      expires: new Date(expiresAt),
      path: '/',
    });
  }
}
