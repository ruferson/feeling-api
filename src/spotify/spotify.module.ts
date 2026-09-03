import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SpotifySyncService } from './spotify-sync.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NodesModule } from '../nodes/nodes.module';

@Module({
  imports: [HttpModule, PrismaModule, NodesModule],
  providers: [SpotifySyncService],
  exports: [SpotifySyncService],
})
export class SpotifyModule {}
