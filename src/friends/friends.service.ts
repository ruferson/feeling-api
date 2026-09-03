import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { FriendsGateway } from './friends.gateway';

@Injectable()
export class FriendsService {
  private readonly logger = new Logger(FriendsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly friendsGateway: FriendsGateway,
  ) {}

  /**
   * Helper utility to verify mutual confirmed friendship between two distinct users.
   */
  async isFriend(userId1: string, userId2: string): Promise<boolean> {
    if (!userId1 || !userId2 || userId1 === userId2) return false;

    const friendship = await this.prisma.friendship.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { senderId: userId1, receiverId: userId2 },
          { senderId: userId2, receiverId: userId1 },
        ],
      },
      select: { id: true },
    });

    return !!friendship;
  }

  /**
   * Dispatches an outbound friend request and notifies the recipient via WebSockets.
   */
  async sendRequest(senderId: string, rawReceiverUsername: string) {
    const receiverUsername = rawReceiverUsername?.trim();
    if (!receiverUsername) {
      throw new BadRequestException('Target username cannot be empty.');
    }

    const receiver = await this.prisma.user.findUnique({
      where: { username: receiverUsername },
      select: { id: true },
    });

    if (!receiver) {
      throw new NotFoundException('The specified user does not exist.');
    }

    const receiverId = receiver.id;

    if (senderId === receiverId) {
      throw new BadRequestException(
        'You cannot send a friend request to yourself.',
      );
    }

    const existing = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId },
        ],
      },
      select: { id: true, status: true },
    });

    if (existing) {
      throw new BadRequestException(
        'A friendship or pending request already exists with this user.',
      );
    }

    const newFriendship = await this.prisma.friendship.create({
      data: {
        senderId,
        receiverId,
        status: 'PENDING',
      },
      include: {
        sender: {
          select: { id: true, username: true, spotifyDisplayName: true },
        },
        receiver: {
          select: { id: true, username: true, spotifyDisplayName: true },
        },
      },
    });

    // Safely emit real-time WebSocket event without breaking DB transaction integrity
    try {
      this.friendsGateway.emitFriendRequest(receiverId, {
        friendshipId: newFriendship.id,
        senderId: newFriendship.senderId,
        username: newFriendship.sender.username,
        spotifyDisplayName: newFriendship.sender.spotifyDisplayName,
      });
    } catch (error) {
      this.logger.error(
        `Failed to emit friend request WebSocket event to user ${receiverId}`,
        error,
      );
    }

    return newFriendship;
  }

  /**
   * Accepts a pending incoming friend request and notifies the original sender in real time.
   */
  async acceptRequest(userId: string, friendshipId: string) {
    const friendship = await this.prisma.friendship.findUnique({
      where: { id: friendshipId },
      select: { id: true, receiverId: true, status: true },
    });

    if (
      !friendship ||
      friendship.receiverId !== userId ||
      friendship.status !== 'PENDING'
    ) {
      throw new NotFoundException('Pending friend request not found.');
    }

    const updated = await this.prisma.friendship.update({
      where: { id: friendshipId },
      data: { status: 'ACCEPTED' },
      include: {
        receiver: {
          select: { id: true, username: true, spotifyDisplayName: true },
        },
      },
    });

    try {
      this.friendsGateway.emitFriendshipAccepted(updated.senderId, {
        friendshipId: updated.id,
        friendUserId: updated.receiverId,
        username: updated.receiver.username,
        spotifyDisplayName: updated.receiver.spotifyDisplayName,
      });
    } catch (error) {
      this.logger.error(
        `Failed to emit friendship accepted WebSocket event to user ${updated.senderId}`,
        error,
      );
    }

    return updated;
  }

  /**
   * Rejects an incoming pending friend request.
   */
  async rejectRequest(userId: string, friendshipId: string) {
    const friendship = await this.prisma.friendship.findUnique({
      where: { id: friendshipId },
      select: { id: true, receiverId: true, senderId: true, status: true },
    });

    if (
      !friendship ||
      friendship.receiverId !== userId ||
      friendship.status !== 'PENDING'
    ) {
      throw new NotFoundException('Pending friend request not found.');
    }

    const deleted = await this.prisma.friendship.delete({
      where: { id: friendshipId },
    });

    try {
      this.friendsGateway.emitFriendshipRemoved(deleted.senderId, {
        friendshipId: deleted.id,
        removedByUserId: userId,
      });
    } catch (error) {
      this.logger.error(
        `Failed to emit friendship rejection WebSocket event to user ${deleted.senderId}`,
        error,
      );
    }

    return deleted;
  }

  /**
   * Removes an active friendship record or cancels an outbound pending request.
   */
  async removeOrReject(userId: string, friendshipId: string) {
    const friendship = await this.prisma.friendship.findUnique({
      where: { id: friendshipId },
      select: { id: true, senderId: true, receiverId: true },
    });

    if (
      !friendship ||
      (friendship.senderId !== userId && friendship.receiverId !== userId)
    ) {
      throw new NotFoundException('Friendship relation not found.');
    }

    const deleted = await this.prisma.friendship.delete({
      where: { id: friendshipId },
    });

    const otherPartyId =
      deleted.senderId === userId ? deleted.receiverId : deleted.senderId;

    try {
      this.friendsGateway.emitFriendshipRemoved(otherPartyId, {
        friendshipId: deleted.id,
        removedByUserId: userId,
      });
    } catch (error) {
      this.logger.error(
        `Failed to emit friendship removal WebSocket event to user ${otherPartyId}`,
        error,
      );
    }

    return deleted;
  }

  /**
   * Retrieves paginated active confirmed friends for a given user.
   */
  async getFriends(userId: string, pagination?: PaginationQueryDto) {
    const page = Math.max(1, pagination?.page ?? 1);
    const limit = Math.min(Math.max(1, pagination?.limit ?? 10), 50);
    const skip = (page - 1) * limit;

    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      take: limit,
      skip: skip,
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            spotifyDisplayName: true,
            node: {
              select: {
                id: true,
                posX: true,
                posY: true,
                status: true,
                bpm: true,
                bpmEstimated: true,
                isPlaying: true,
                songTitle: true,
                artist: true,
              },
            },
          },
        },
        receiver: {
          select: {
            id: true,
            username: true,
            spotifyDisplayName: true,
            node: {
              select: {
                id: true,
                posX: true,
                posY: true,
                status: true,
                bpm: true,
                bpmEstimated: true,
                isPlaying: true,
                songTitle: true,
                artist: true,
              },
            },
          },
        },
      },
    });

    return friendships.map((f) => {
      const friend = f.senderId === userId ? f.receiver : f.sender;
      return {
        friendshipId: f.id,
        userId: friend.id,
        username: friend.username,
        spotifyDisplayName: friend.spotifyDisplayName,
        node: friend.node,
      };
    });
  }

  /**
   * Retrieves paginated outbound pending requests sent by a given user.
   */
  async getSentRequests(userId: string, pagination?: PaginationQueryDto) {
    const page = Math.max(1, pagination?.page ?? 1);
    const limit = Math.min(Math.max(1, pagination?.limit ?? 10), 50);
    const skip = (page - 1) * limit;

    const requests = await this.prisma.friendship.findMany({
      where: {
        senderId: userId,
        status: 'PENDING',
      },
      take: limit,
      skip: skip,
      include: {
        receiver: {
          select: { id: true, username: true, spotifyDisplayName: true },
        },
      },
    });

    return requests.map((r) => ({
      id: r.id,
      friendshipId: r.id,
      userId: r.receiver.id,
      username: r.receiver.username,
      spotifyDisplayName: r.receiver.spotifyDisplayName,
      createdAt: r.createdAt,
    }));
  }

  /**
   * Retrieves paginated incoming pending requests waiting for approval.
   */
  async getPendingRequests(userId: string, pagination?: PaginationQueryDto) {
    const page = Math.max(1, pagination?.page ?? 1);
    const limit = Math.min(Math.max(1, pagination?.limit ?? 10), 50);
    const skip = (page - 1) * limit;

    const requests = await this.prisma.friendship.findMany({
      where: {
        receiverId: userId,
        status: 'PENDING',
      },
      take: limit,
      skip: skip,
      include: {
        sender: {
          select: { id: true, username: true, spotifyDisplayName: true },
        },
      },
    });

    return requests.map((r) => ({
      id: r.id,
      friendshipId: r.id,
      userId: r.sender.id,
      username: r.sender.username,
      spotifyDisplayName: r.sender.spotifyDisplayName,
      createdAt: r.createdAt,
    }));
  }
}
