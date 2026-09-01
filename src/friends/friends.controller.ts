import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { FriendsService } from './friends.service';
import { SendRequestDto } from './dto/send-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';

@Controller('friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Post('request')
  async sendRequest(
    @Req() req: Request & { user: { id?: string; sub?: string } },
    @Body() dto: SendRequestDto,
  ) {
    const senderId = req.user.id ?? req.user.sub;
    return this.friendsService.sendRequest(senderId!, dto.username);
  }

  @Post('accept/:id')
  async acceptRequest(
    @Req() req: Request & { user: { id?: string; sub?: string } },
    @Param('id') friendshipId: string,
  ) {
    const userId = req.user.id ?? req.user.sub;
    return this.friendsService.acceptRequest(userId!, friendshipId);
  }

  @Post('reject/:id')
  async rejectRequest(
    @Req() req: Request & { user: { id?: string; sub?: string } },
    @Param('id') friendshipId: string,
  ) {
    const userId = req.user.id ?? req.user.sub;
    return this.friendsService.rejectRequest(userId!, friendshipId);
  }

  @Delete(':id')
  async removeOrReject(
    @Req() req: Request & { user: { id?: string; sub?: string } },
    @Param('id') friendshipId: string,
  ) {
    const userId = req.user.id ?? req.user.sub;
    return this.friendsService.removeOrReject(userId!, friendshipId);
  }

  @Get()
  async getFriends(
    @Req() req: Request & { user: { id?: string; sub?: string } },
  ) {
    const userId = req.user.id ?? req.user.sub;
    return this.friendsService.getFriends(userId!);
  }

  @Get('sent')
  async getSentRequests(
    @Req() req: Request & { user: { id?: string; sub?: string } },
  ) {
    const userId = req.user.id ?? req.user.sub;
    return this.friendsService.getSentRequests(userId!);
  }

  @Get('pending')
  async getPendingRequests(
    @Req() req: Request & { user: { id?: string; sub?: string } },
  ) {
    const userId = req.user.id ?? req.user.sub;
    return this.friendsService.getPendingRequests(userId!);
  }
}
