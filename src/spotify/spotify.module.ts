import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SpotifySyncService } from './spotify-sync.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [HttpModule, PrismaModule],
  providers: [SpotifySyncService],
  exports: [SpotifySyncService],
})
export class SpotifyModule {}
