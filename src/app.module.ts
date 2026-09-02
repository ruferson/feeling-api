import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { NodesModule } from './nodes/nodes.module';
import { SpotifyModule } from './spotify/spotify.module';
import { FriendsModule } from './friends/friends.module';
import { LobbiesModule } from './lobbies/lobbies.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    UsersModule,
    AuthModule,
    NodesModule,
    FriendsModule,
    SpotifyModule,
    LobbiesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
