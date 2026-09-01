import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { NodesModule } from './nodes/nodes.module';
import { ScheduleModule } from '@nestjs/schedule';
import { SpotifyModule } from './spotify/spotify.module';
import { FriendsModule } from './friends/friends.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    SpotifyModule,
    PrismaModule,
    UsersModule,
    AuthModule,
    NodesModule,
    FriendsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
