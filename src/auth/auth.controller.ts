import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { SpotifyAuthDto } from './dto/spotify-auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User successfully created.' })
  @ApiResponse({ status: 409, description: 'Email or Username conflict.' })
  @ApiResponse({ status: 429, description: 'Too Many Requests.' })
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user' })
  @ApiResponse({ status: 200, description: 'Authentication successful.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  @ApiResponse({ status: 429, description: 'Too Many Requests.' })
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get('spotify/login-url')
  getSpotifyLoginUrl() {
    return this.authService.getSpotifyLoginUrl();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req: any) {
    return req.user;
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('spotify')
  linkSpotify(@Request() req: any, @Body() spotifyAuthDto: SpotifyAuthDto) {
    return this.authService.linkSpotifyAccount(
      req.user.id,
      spotifyAuthDto.code,
    );
  }
}
