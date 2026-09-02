import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from '../auth/dto/register.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(registerDto: RegisterDto) {
    return this.prisma.user.create({
      data: {
        username: registerDto.username,
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

  async findByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username },
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
        username: true,
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

  async searchUsers(query: string, currentUserId: string) {
    return this.prisma.user.findMany({
      where: {
        id: { not: currentUserId },
        username: { contains: query, mode: 'insensitive' },
      },
      select: {
        id: true,
        username: true,
        node: true,
      },
      take: 10,
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
        username: true,
        email: true,
        spotifyAccountId: true,
        spotifyDisplayName: true,
        spotifyConnectedAt: true,
      },
    });
  }
}
