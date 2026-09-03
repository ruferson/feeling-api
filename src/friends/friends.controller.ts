import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { FriendsService } from './friends.service';
import { SendRequestDto } from './dto/send-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';
import { PaginationQueryDto } from './dto/pagination-query.dto';

@ApiTags('friends')
@ApiBearerAuth()
@Controller('friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  // Strict limit on outbound request submission to avoid user spamming
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Send a friend request to another user by username',
  })
  @ApiResponse({
    status: 201,
    description: 'Friend request sent successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot send request to self or duplicate request.',
  })
  @ApiResponse({ status: 404, description: 'Target user not found.' })
  @ApiResponse({ status: 429, description: 'Too Many Requests.' })
  @Post('request')
  async sendRequest(
    @Req() req: Request & { user: { id?: string; sub?: string } },
    @Body() dto: SendRequestDto,
  ) {
    const senderId = req.user.id ?? req.user.sub;
    return this.friendsService.sendRequest(senderId!, dto.username);
  }

  @ApiOperation({ summary: 'Accept a pending incoming friend request' })
  @ApiParam({ name: 'id', description: 'Friendship UUID identifier' })
  @ApiResponse({
    status: 201,
    description: 'Friend request accepted successfully.',
  })
  @ApiResponse({
    status: 404,
    description: 'Friend request not found or unauthorized.',
  })
  @Post('accept/:id')
  async acceptRequest(
    @Req() req: Request & { user: { id?: string; sub?: string } },
    @Param('id', ParseUUIDPipe) friendshipId: string,
  ) {
    const userId = req.user.id ?? req.user.sub;
    return this.friendsService.acceptRequest(userId!, friendshipId);
  }

  @ApiOperation({ summary: 'Reject a pending incoming friend request' })
  @ApiParam({ name: 'id', description: 'Friendship UUID identifier' })
  @ApiResponse({
    status: 201,
    description: 'Friend request rejected successfully.',
  })
  @ApiResponse({
    status: 404,
    description: 'Friend request not found or unauthorized.',
  })
  @Post('reject/:id')
  async rejectRequest(
    @Req() req: Request & { user: { id?: string; sub?: string } },
    @Param('id', ParseUUIDPipe) friendshipId: string,
  ) {
    const userId = req.user.id ?? req.user.sub;
    return this.friendsService.rejectRequest(userId!, friendshipId);
  }

  @ApiOperation({
    summary: 'Remove an established friendship or cancel a sent request',
  })
  @ApiParam({ name: 'id', description: 'Friendship UUID identifier' })
  @ApiResponse({ status: 200, description: 'Friendship removed successfully.' })
  @ApiResponse({
    status: 404,
    description: 'Friendship relationship not found or unauthorized.',
  })
  @Delete(':id')
  async removeOrReject(
    @Req() req: Request & { user: { id?: string; sub?: string } },
    @Param('id', ParseUUIDPipe) friendshipId: string,
  ) {
    const userId = req.user.id ?? req.user.sub;
    return this.friendsService.removeOrReject(userId!, friendshipId);
  }

  // Moderate rate limits for read endpoints (60 calls per minute) to allow legitimate UI refreshes
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({
    summary: 'Get list of active friends for authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'Active friends retrieved successfully.',
  })
  @Get()
  async getFriends(
    @Req() req: Request & { user: { id?: string; sub?: string } },
    @Query() query: PaginationQueryDto,
  ) {
    const userId = req.user.id ?? req.user.sub;
    return this.friendsService.getFriends(userId!, query);
  }

  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Get list of pending sent friend requests' })
  @ApiResponse({
    status: 200,
    description: 'Sent requests retrieved successfully.',
  })
  @Get('sent')
  async getSentRequests(
    @Req() req: Request & { user: { id?: string; sub?: string } },
    @Query() query: PaginationQueryDto,
  ) {
    const userId = req.user.id ?? req.user.sub;
    return this.friendsService.getSentRequests(userId!, query);
  }

  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Get list of pending incoming friend requests' })
  @ApiResponse({
    status: 200,
    description: 'Pending requests retrieved successfully.',
  })
  @Get('pending')
  async getPendingRequests(
    @Req() req: Request & { user: { id?: string; sub?: string } },
    @Query() query: PaginationQueryDto,
  ) {
    const userId = req.user.id ?? req.user.sub;
    return this.friendsService.getPendingRequests(userId!, query);
  }
}
