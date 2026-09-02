import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { LobbyNameGenerator } from './utils/lobby-name-generator';

@Injectable()
export class LobbiesService {
  private readonly logger = new Logger(LobbiesService.name);
  private readonly MAX_CAPACITY = 20;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Periodic cleanup task that removes lobbies containing 0 active nodes.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async cleanupEmptyLobbies(): Promise<void> {
    try {
      const result = await this.prisma.lobby.deleteMany({
        where: {
          nodes: {
            none: {},
          },
        },
      });

      if (result.count > 0) {
        this.logger.log(`Cleaned up ${result.count} empty lobbies.`);
      }
    } catch (error) {
      this.logger.error('Error occurred while cleaning empty lobbies', error);
    }
  }

  /**
   * Finds an available active lobby with fewer than 20 nodes or creates a new one.
   * Then assigns or updates the given user's node to belong to this lobby.
   */
  async getOrCreateAvailableLobbyForUser(userId: string) {
    let userNode = await this.prisma.node.findUnique({
      where: { userId },
      include: { lobby: true },
    });

    if (!userNode) {
      throw new NotFoundException('Node entity not found for this user');
    }

    if (userNode.lobbyId) {
      const currentLobbyCount = await this.prisma.node.count({
        where: { lobbyId: userNode.lobbyId },
      });

      if (currentLobbyCount <= this.MAX_CAPACITY) {
        return this.getLobbyDetails(userNode.lobbyId);
      }
    }

    const availableLobbies = await this.prisma.lobby.findMany({
      include: {
        _count: {
          select: { nodes: true },
        },
      },
    });

    const openLobby = availableLobbies.find(
      (lobby) => lobby._count.nodes < this.MAX_CAPACITY,
    );

    let targetLobbyId: string;

    if (openLobby) {
      targetLobbyId = openLobby.id;
    } else {
      const newLobby = await this.prisma.lobby.create({
        data: {
          name: LobbyNameGenerator.generateName(),
          maxCapacity: this.MAX_CAPACITY,
        },
      });
      targetLobbyId = newLobby.id;
    }

    await this.prisma.node.update({
      where: { userId },
      data: { lobbyId: targetLobbyId },
    });

    return this.getLobbyDetails(targetLobbyId);
  }

  /**
   * Retrieves full details of a lobby including its active nodes and occupants count.
   */
  async getLobbyDetails(lobbyId: string) {
    const lobby = await this.prisma.lobby.findUnique({
      where: { id: lobbyId },
      include: {
        nodes: {
          select: {
            id: true,
            userId: true,
            posX: true,
            posY: true,
            status: true,
            isPlaying: true,
            songTitle: true,
            artist: true,
            user: {
              select: {
                id: true,
                username: true,
                spotifyDisplayName: true,
              },
            },
          },
        },
      },
    });

    if (!lobby) {
      throw new NotFoundException('Lobby not found');
    }

    return {
      id: lobby.id,
      name: lobby.name,
      occupantsCount: lobby.nodes.length,
      maxCapacity: lobby.maxCapacity,
      createdAt: lobby.createdAt,
      nodes: lobby.nodes,
    };
  }

  /**
   * Gets the current lobby details for the requesting user.
   */
  async getUserLobby(userId: string) {
    const node = await this.prisma.node.findUnique({
      where: { userId },
      select: { lobbyId: true },
    });

    if (!node || !node.lobbyId) {
      return this.getOrCreateAvailableLobbyForUser(userId);
    }

    return this.getLobbyDetails(node.lobbyId);
  }

  /**
   * Allows a user to move to their friend's lobby if there is available capacity (< 20).
   */
  async switchLobbyToFriend(userId: string, friendId: string) {
    if (userId === friendId) {
      throw new BadRequestException('Cannot switch lobby to yourself');
    }

    const friendship = await this.prisma.friendship.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { senderId: userId, receiverId: friendId },
          { senderId: friendId, receiverId: userId },
        ],
      },
    });

    if (!friendship) {
      throw new BadRequestException('Target user is not an accepted friend');
    }

    const friendNode = await this.prisma.node.findUnique({
      where: { userId: friendId },
      select: { lobbyId: true },
    });

    if (!friendNode || !friendNode.lobbyId) {
      throw new NotFoundException('Friend is not currently in an active lobby');
    }

    const friendLobbyId = friendNode.lobbyId;

    const currentOccupantsCount = await this.prisma.node.count({
      where: { lobbyId: friendLobbyId },
    });

    if (currentOccupantsCount >= this.MAX_CAPACITY) {
      throw new BadRequestException(
        "Friend's lobby has reached maximum capacity (20/20)",
      );
    }

    await this.prisma.node.update({
      where: { userId },
      data: { lobbyId: friendLobbyId },
    });

    return this.getLobbyDetails(friendLobbyId);
  }
}
