import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { LobbiesService } from './lobbies.service';
import { JoinFriendLobbyDto } from './dto/join-friend-lobby.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';

@ApiTags('lobbies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('lobbies')
export class LobbiesController {
  constructor(private readonly lobbiesService: LobbiesService) {}

  @ApiOperation({
    summary:
      'Get current lobby details and occupant nodes for authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'Lobby details retrieved successfully.',
  })
  @ApiResponse({ status: 404, description: 'User node not found.' })
  @Get('my-lobby')
  async getMyLobby(
    @Req() req: Request & { user: { id?: string; sub?: string } },
  ) {
    const userId = req.user.id ?? req.user.sub;
    return this.lobbiesService.getUserLobby(userId!);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary:
      "Switch current user to a friend's lobby if space is available (< 20)",
  })
  @ApiResponse({
    status: 200,
    description: "Switched to friend's lobby successfully.",
  })
  @ApiResponse({
    status: 400,
    description: "Target is not a friend or friend's lobby is full.",
  })
  @ApiResponse({
    status: 404,
    description: 'Friend not found or not in a lobby.',
  })
  @Post('join-friend')
  async joinFriendLobby(
    @Req() req: Request & { user: { id?: string; sub?: string } },
    @Body() dto: JoinFriendLobbyDto,
  ) {
    const userId = req.user.id ?? req.user.sub;
    return this.lobbiesService.switchLobbyToFriend(userId!, dto.friendId);
  }
}
