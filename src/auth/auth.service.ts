import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly httpService: HttpService,
  ) {}

  async register(registerDto: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('Email address is already registered');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    const user = await this.usersService.create({
      ...registerDto,
      password: hashedPassword,
    });

    const payload = { sub: user.id, email: user.email };
    return {
      user: {
        id: user.id,
        email: user.email,
        node: user.node,
      },
      accessToken: this.jwtService.sign(payload),
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, email: user.email };
    return {
      user: {
        id: user.id,
        email: user.email,
        node: user.node,
      },
      accessToken: this.jwtService.sign(payload),
    };
  }

  async linkSpotifyAccount(userId: string, code: string) {
    const fastApiUrl = process.env.FASTAPI_URL || 'http://localhost:8000';

    // 1. Obtain Spotify tokens and profile via FastAPI
    const response = await firstValueFrom(
      this.httpService.post(`${fastApiUrl}/auth/spotify/${userId}`, { code }),
    );
    const account = response.data;

    // 2. Validate if this Spotify account is already linked to ANOTHER user
    const existingUser = await this.usersService.findBySpotifyAccountId(
      account.spotifyAccountId,
    );

    if (existingUser && existingUser.id !== userId) {
      // Revert token storage in FastAPI so polling stops immediately
      try {
        await firstValueFrom(
          this.httpService.delete(`${fastApiUrl}/auth/spotify/${userId}`),
        );
      } catch {
        // Ignore cleanup network errors
      }

      throw new ConflictException(
        'Esta cuenta de Spotify ya está sincronizada con una cuenta de FeelinG',
      );
    }

    // 3. Connect Spotify account in NestJS database
    try {
      return await this.usersService.connectSpotify(
        userId,
        account.spotifyAccountId,
        account.spotifyDisplayName,
      );
    } catch (error) {
      // Revert FastAPI tokens if database write fails for any other reason
      try {
        await firstValueFrom(
          this.httpService.delete(`${fastApiUrl}/auth/spotify/${userId}`),
        );
      } catch {
        // Ignore cleanup network errors
      }
      throw error;
    }
  }

  async getSpotifyLoginUrl() {
    const fastApiUrl = process.env.FASTAPI_URL || 'http://localhost:8000';
    const response = await firstValueFrom(
      this.httpService.get(`${fastApiUrl}/auth/spotify/login-url`),
    );
    return response.data;
  }
}
