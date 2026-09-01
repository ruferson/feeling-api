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
    const existingEmail = await this.usersService.findByEmail(
      registerDto.email,
    );
    if (existingEmail) {
      throw new ConflictException('Email address is already registered');
    }

    const existingUsername = await this.usersService.findByUsername(
      registerDto.username,
    );
    if (existingUsername) {
      throw new ConflictException('Username is already taken');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    const user = await this.usersService.create({
      ...registerDto,
      password: hashedPassword,
    });

    const payload = { sub: user.id, username: user.username };
    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        node: user.node,
      },
      accessToken: this.jwtService.sign(payload),
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByUsername(loginDto.username);
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

    const payload = { sub: user.id, username: user.username };
    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        node: user.node,
      },
      accessToken: this.jwtService.sign(payload),
    };
  }

  async linkSpotifyAccount(userId: string, code: string) {
    const fastApiUrl = process.env.FASTAPI_URL || 'http://localhost:8000';

    const response = await firstValueFrom(
      this.httpService.post(`${fastApiUrl}/auth/spotify/${userId}`, { code }),
    );
    const account = response.data;

    const existingUser = await this.usersService.findBySpotifyAccountId(
      account.spotifyAccountId,
    );

    if (existingUser && existingUser.id !== userId) {
      try {
        await firstValueFrom(
          this.httpService.delete(`${fastApiUrl}/auth/spotify/${userId}`),
        );
      } catch {}

      throw new ConflictException(
        'Esta cuenta de Spotify ya está sincronizada con una cuenta de FeelinG',
      );
    }

    try {
      return await this.usersService.connectSpotify(
        userId,
        account.spotifyAccountId,
        account.spotifyDisplayName,
      );
    } catch (error) {
      try {
        await firstValueFrom(
          this.httpService.delete(`${fastApiUrl}/auth/spotify/${userId}`),
        );
      } catch {}
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
