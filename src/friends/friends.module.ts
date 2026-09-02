import { Module } from '@nestjs/common';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';
import { FriendsGateway } from './friends.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [FriendsController],
  providers: [FriendsService, FriendsGateway],
  exports: [FriendsService, FriendsGateway],
})
export class FriendsModule {}
