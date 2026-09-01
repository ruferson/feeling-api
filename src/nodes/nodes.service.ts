import { Injectable, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateLocationDto } from './dto/update-location.dto';

@Injectable()
export class NodesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
  ) {}

  // Fetch all active nodes with their associated user details
  async findAll() {
    const nodes = await this.prisma.node.findMany({
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    return nodes.map((node) => ({
      id: node.userId,
      label: node.user?.username ?? 'User',
      posX: node.posX,
      posY: node.posY,
      status: 'ACTIVE',
      bpm: node.bpm || 0,
      bpmEstimated: node.bpmEstimated,
      isPlaying: node.isPlaying,
      songTitle: node.songTitle,
      artist: node.artist,
    }));
  }

  async updateLocation(userId: string, updateLocationDto: UpdateLocationDto) {
    const node = await this.prisma.node.findUnique({
      where: { userId },
    });

    if (!node) {
      throw new NotFoundException('Node not found for this user');
    }

    return this.prisma.node.update({
      where: { userId },
      data: {
        posX: updateLocationDto.posX,
        posY: updateLocationDto.posY,
        ...(updateLocationDto.bpm !== undefined && {
          bpm: updateLocationDto.bpm,
        }),
      },
    });
  }

  async getSongInfoFromFastApi(nodeId: string) {
    const fastApiUrl = process.env.FASTAPI_URL || 'http://localhost:8000';
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${fastApiUrl}/nodes/${nodeId}/song`),
      );
      return response.data;
    } catch {
      return {
        song: 'Unknown',
        artist: 'Unknown',
        synced: false,
      };
    }
  }
}
