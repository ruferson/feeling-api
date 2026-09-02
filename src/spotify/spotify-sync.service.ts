import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { firstValueFrom } from 'rxjs';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FastApiSongResponseDto } from './dto/fastapi-song-response.dto';

@Injectable()
export class SpotifySyncService {
  private readonly logger = new Logger(SpotifySyncService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async handleSpotifySync(): Promise<void> {
    const fastApiUrl = process.env.FASTAPI_URL || 'http://localhost:8000';

    try {
      const nodes = await this.prisma.node.findMany();

      for (const node of nodes) {
        try {
          const response = await firstValueFrom(
            this.httpService.get<FastApiSongResponseDto>(
              `${fastApiUrl}/nodes/${node.userId}/song`,
            ),
          );

          const songData = response.data;

          if (songData) {
            await this.prisma.node.update({
              where: { id: node.id },
              data: {
                songTitle: songData.synced ? songData.song : '',
                artist: songData.synced ? songData.artist : '',
                isPlaying: songData.synced && songData.isPlaying === true,
              },
            });
          }
        } catch {
          this.logger.warn(`Failed to sync node ${node.id}`);
        }
      }
    } catch (error) {
      this.logger.error(
        'Error during Spotify synchronization with FastAPI',
        error,
      );
    }
  }
}
