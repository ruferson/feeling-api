import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { SkipThrottle } from '@nestjs/throttler';

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

@SkipThrottle()
@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  transports: ['websocket', 'polling'],
  namespace: '/api/friends',
})
export class FriendsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(FriendsGateway.name);

  constructor(private readonly jwtService: JwtService) {}

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

  handleDisconnect(client: Socket): void {
    const userId = client.data?.userId ?? 'Unauthenticated';
    this.logger.log(
      `Friends Gateway client disconnected [User ID: ${userId} | Socket ID: ${client.id}]`,
    );
  }

  emitFriendRequest(targetUserId: string, payload: FriendRequestPayload): void {
    if (!targetUserId) return;
    this.server
      .to(`user_${targetUserId}`)
      .emit('friend_request_received', payload);
  }

  emitFriendshipAccepted(
    targetUserId: string,
    payload: FriendshipAcceptedPayload,
  ): void {
    if (!targetUserId) return;
    this.server.to(`user_${targetUserId}`).emit('friendship_accepted', payload);
  }

  emitFriendshipRemoved(
    targetUserId: string,
    payload: FriendshipRemovedPayload,
  ): void {
    if (!targetUserId) return;
    this.server.to(`user_${targetUserId}`).emit('friendship_removed', payload);
  }
}
