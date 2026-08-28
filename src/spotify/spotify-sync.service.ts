import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { firstValueFrom } from 'rxjs';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class SpotifySyncService {
  private readonly logger = new Logger(SpotifySyncService.name);
  private readonly fastApiUrl = 'http://localhost:8000';

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {}

  // Se ejecuta automáticamente cada 10 segundos
  @Cron(CronExpression.EVERY_10_SECONDS)
  async handleSpotifySync() {
    try {
      // 1. Obtener todos los nodos registrados en la base de datos de NestJS
      const nodes = await this.prisma.node.findMany();

      for (const node of nodes) {
        try {
          // 2. Consultar a FastAPI la canción actual del nodo
          const response = await firstValueFrom(
            this.httpService.get(
              `${this.fastApiUrl}/nodes/${node.userId}/song`,
            ),
          );

          const songData = response.data;

          if (songData) {
            // 3. Persistir la información real de Spotify en la base de datos de NestJS
            await this.prisma.node.update({
              where: { id: node.id },
              data: {
                songTitle: songData.synced ? songData.song : '',
                artist: songData.synced ? songData.artist : '',
                bpm: songData.synced ? songData.bpm : 0,
                bpmEstimated: songData.synced && songData.bpmEstimated === true,
                isPlaying: songData.synced && songData.isPlaying === true,
              },
            });
          }
        } catch {
          this.logger.warn(`No se pudo sincronizar el nodo ${node.id}`);
        }
      }
    } catch (error) {
      this.logger.error(
        'Error durante la sincronización de Spotify con FastAPI',
        error,
      );
    }
  }
}
