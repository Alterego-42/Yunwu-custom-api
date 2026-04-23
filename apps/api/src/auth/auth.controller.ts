import { Body, Controller, Get, Header, Post, Req, Res } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { Public } from "./public.decorator";

interface ResponseLike {
  setHeader(name: string, value: string): void;
}

interface RequestLike {
  headers?: Record<string, string | string[] | undefined>;
}

@Controller("api/auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("login")
  async login(
    @Body() input: LoginDto,
    @Res({ passthrough: true }) response: ResponseLike,
  ) {
    const user = await this.authService.login(input.email, input.password);
    response.setHeader(
      "Set-Cookie",
      this.authService.createSessionCookie(
        this.authService.createSessionToken(user),
      ),
    );

    return { user };
  }

  @Public()
  @Get("me")
  async getCurrentUser(@Req() request: RequestLike) {
    const user = await this.authService.authenticateRequest(request);
    return user ? { user } : null;
  }

  @Public()
  @Post("logout")
  @Header("Cache-Control", "no-store")
  logout(@Res({ passthrough: true }) response: ResponseLike) {
    response.setHeader(
      "Set-Cookie",
      this.authService.createExpiredSessionCookie(),
    );

    return { success: true };
  }
}
