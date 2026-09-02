import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateLocationDto } from './dto/update-location.dto';

@Injectable()
export class NodesService {
  private readonly logger = new Logger(NodesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
  ) {}

  // Fetch all active nodes filtering Spotify details based on friendship status
  async findAll(requestingUserId: string) {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ senderId: requestingUserId }, { receiverId: requestingUserId }],
      },
    });

    const friendUserIds = new Set<string>(
      friendships.map((f) =>
        f.senderId === requestingUserId ? f.receiverId : f.senderId,
      ),
    );

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

    return nodes.map((node) => {
      const isOwner = node.userId === requestingUserId;
      const isFriend = friendUserIds.has(node.userId);
      const canSeeSpotify = isOwner || isFriend;

      return {
        id: node.userId,
        label: node.user?.username ?? 'User',
        posX: node.posX,
        posY: node.posY,
        status: 'ACTIVE',
        bpm: canSeeSpotify ? node.bpm || 0 : 0,
        bpmEstimated: canSeeSpotify ? node.bpmEstimated : false,
        isPlaying: canSeeSpotify ? node.isPlaying : false,
        songTitle: canSeeSpotify ? node.songTitle : '',
        artist: canSeeSpotify ? node.artist : '',
      };
    });
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
    } catch (error) {
      this.logger.warn(
        `Failed to fetch song info from FastAPI for node ${nodeId}`,
      );
      return {
        song: 'Unknown',
        artist: 'Unknown',
        synced: false,
      };
    }
  }
}
