import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { SignInDto } from './dto/sign-in.dto';
import { SignUpDto } from './dto/sign-up.dto';
import type { UserResponseDto } from './dto/user-response.dto';
import { CurrentSessionId, CurrentUser, Public } from './identity.decorators';
import { IDENTITY_SERVICE } from './identity.tokens';
import type { IIdentityService, SignedInUser } from './interfaces/identity-service.interface';
import { SessionCookie } from './session-cookie';

/** Controller for Identity under `/api/v1`: parses the request, calls the service, sets the Session cookie. */
@Controller()
export class IdentityController {
  constructor(
    @Inject(IDENTITY_SERVICE) private readonly identity: IIdentityService,
    private readonly sessionCookie: SessionCookie,
  ) {}

  /** Sign up — creates the User and signs them in. */
  @Public()
  @Post('users')
  async signUp(
    @Body() body: SignUpDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<UserResponseDto> {
    const { sessionId, user } = await this.identity.signUp(body);
    this.sessionCookie.set(res, sessionId);
    return user;
  }

  /** Sign in — opens a new Session (a 200, not a 201: the browser's cookie is the thing created). */
  @Public()
  @Post('sessions')
  @HttpCode(HttpStatus.OK)
  async signIn(
    @Body() body: SignInDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<UserResponseDto> {
    const { sessionId, user } = await this.identity.signIn(body);
    this.sessionCookie.set(res, sessionId);
    return user;
  }

  /** Who is signed in. */
  @Get('me')
  me(@CurrentUser() current: SignedInUser): Promise<UserResponseDto> {
    return this.identity.getUser(current.userId);
  }

  /** Sign out — ends only the Session this request used. */
  @Delete('sessions/current')
  @HttpCode(HttpStatus.NO_CONTENT)
  async signOut(
    @CurrentSessionId() sessionId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.identity.signOut(sessionId);
    this.sessionCookie.clear(res);
  }
}
