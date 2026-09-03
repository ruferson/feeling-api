import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { firstValueFrom } from 'rxjs';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FastApiSongResponseDto } from './dto/fastapi-song-response.dto';
import { NodesGateway } from '../nodes/nodes.gateway';
import { NodeStatus } from '@prisma/client';

/// Service polling Spotify playback state via FastAPI service
/// and emitting real-time WebSocket events upon playback state changes.
@Injectable()
export class SpotifySyncService {
  private readonly logger = new Logger(SpotifySyncService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
    private readonly nodesGateway: NodesGateway,
  ) {}

  /// Continuous background synchronization cycle executed every 5 seconds.
  @Cron(CronExpression.EVERY_5_SECONDS)
  async handleSpotifySync(): Promise<void> {
    const fastApiUrl = process.env.FASTAPI_URL || 'http://localhost:8000';

    try {
      const nodes = await this.prisma.node.findMany({
        include: {
          user: {
            select: {
              username: true,
            },
          },
        },
      });

      await Promise.all(
        nodes.map(async (node) => {
          try {
            const response = await firstValueFrom(
              this.httpService.get<FastApiSongResponseDto>(
                `${fastApiUrl}/nodes/${node.userId}/song`,
                { timeout: 7000 },
              ),
            );

            const songData = response.data;
            if (!songData) return;

            const newTitle = songData.synced ? (songData.song ?? '') : '';
            const newArtist = songData.synced ? (songData.artist ?? '') : '';
            const newIsPlaying = songData.synced && songData.isPlaying === true;

            const hasChanged =
              node.songTitle !== newTitle ||
              node.artist !== newArtist ||
              node.isPlaying !== newIsPlaying;

            if (hasChanged) {
              const updatedNode = await this.prisma.node.update({
                where: { id: node.id },
                data: {
                  songTitle: newTitle,
                  artist: newArtist,
                  isPlaying: newIsPlaying,
                  status:
                    newTitle.trim().length > 0
                      ? NodeStatus.ACTIVE
                      : NodeStatus.IDLE,
                },
                include: {
                  user: {
                    select: {
                      username: true,
                    },
                  },
                },
              });

              // Broadcast updated node state via WebSockets
              this.nodesGateway.broadcastNodeUpdate(node.userId, updatedNode);
            }
          } catch (error: any) {
            const errorDetails =
              error?.response?.data || error?.message || error;
            this.logger.warn(
              `Failed to sync Spotify playback for node ${node.id}: ${JSON.stringify(errorDetails)}`,
            );
          }
        }),
      );
    } catch (error) {
      this.logger.error(
        'Error during Spotify synchronization with FastAPI service',
        error,
      );
    }
  }
}
