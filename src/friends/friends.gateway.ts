import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

/**
 * Data Transfer Objects enforcing type safety on real-time outbound WebSocket payloads.
 */
export interface FriendRequestPayload {
  friendshipId: string;
  senderId: string;
  username: string;
  spotifyDisplayName?: string | null;
}

export interface FriendshipAcceptedPayload {
  friendshipId: string;
  friendUserId: string;
  username: string;
  spotifyDisplayName?: string | null;
}

export interface FriendshipRemovedPayload {
  friendshipId: string;
  removedByUserId: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : [
          'http://localhost:3000',
          'http://localhost:3002',
          'http://127.0.0.1:3002',
        ],
    credentials: true,
  },
  namespace: 'friends',
})
export class FriendsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(FriendsGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  /**
   * Validates inbound socket connection requests using JWT bearer authentication.
   * On successful verification, registers the socket into an isolated user-specific room.
   */
  async handleConnection(client: Socket): Promise<void> {
    const authToken = client.handshake.auth?.token as string | undefined;
    const authorization = client.handshake.headers.authorization;
    const token = authToken ?? authorization?.replace(/^Bearer\s+/i, '');

    if (!token) {
      this.logger.warn(
        `Rejected unauthenticated connection attempt on Friends Gateway [Socket ID: ${client.id}]`,
      );
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string }>(token);

      if (!payload?.sub) {
        this.logger.warn(
          `JWT payload verification failed: Missing subject claim [Socket ID: ${client.id}]`,
        );
        client.disconnect(true);
        return;
      }

      client.data.userId = payload.sub;

      // Register socket to target user's isolated room for direct peer-to-peer event dispatches
      const userRoom = `user_${payload.sub}`;
      await client.join(userRoom);

      this.logger.log(
        `Authenticated client [Socket ID: ${client.id}] connected to personal room: ${userRoom}`,
      );
    } catch (error) {
      this.logger.warn(
        `Invalid or expired JWT token provided on Friends Gateway [Socket ID: ${client.id}]`,
      );
      client.disconnect(true);
    }
  }

  /**
   * Handles socket disconnection events and performs necessary resource cleanup.
   */
  handleDisconnect(client: Socket): void {
    const userId = client.data?.userId ?? 'Unauthenticated';
    this.logger.log(
      `Friends Gateway client disconnected [User ID: ${userId} | Socket ID: ${client.id}]`,
    );
  }

  /**
   * Dispatches an inbound friend request notification event strictly to the target user's room.
   */
  emitFriendRequest(targetUserId: string, payload: FriendRequestPayload): void {
    if (!targetUserId) return;
    this.server
      .to(`user_${targetUserId}`)
      .emit('friend_request_received', payload);
  }

  /**
   * Dispatches a friendship acceptance notification event strictly to the target user's room.
   */
  emitFriendshipAccepted(
    targetUserId: string,
    payload: FriendshipAcceptedPayload,
  ): void {
    if (!targetUserId) return;
    this.server.to(`user_${targetUserId}`).emit('friendship_accepted', payload);
  }

  /**
   * Dispatches a friendship removal or rejection event strictly to the target user's room.
   */
  emitFriendshipRemoved(
    targetUserId: string,
    payload: FriendshipRemovedPayload,
  ): void {
    if (!targetUserId) return;
    this.server.to(`user_${targetUserId}`).emit('friendship_removed', payload);
  }
}
