import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from '../auth/dto/register.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(registerDto: RegisterDto) {
    return this.prisma.user.create({
      data: {
        email: registerDto.email,
        password: registerDto.password,
        node: {
          create: {
            posX: registerDto.posX,
            posY: registerDto.posY,
            status: 'IDLE',
          },
        },
      },
      include: {
        node: true,
      },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        node: true,
      },
    });
  }

  async findBySpotifyAccountId(spotifyAccountId: string) {
    return this.prisma.user.findUnique({
      where: { spotifyAccountId },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        spotifyAccountId: true,
        spotifyDisplayName: true,
        spotifyConnectedAt: true,
        createdAt: true,
        updatedAt: true,
        node: true,
      },
    });
  }

  async connectSpotify(
    userId: string,
    spotifyAccountId: string,
    spotifyDisplayName?: string,
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        spotifyAccountId,
        spotifyDisplayName,
        spotifyConnectedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        spotifyAccountId: true,
        spotifyDisplayName: true,
        spotifyConnectedAt: true,
      },
    });
  }
}
