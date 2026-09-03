import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { UsePipes, ValidationPipe, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { NodesService } from './nodes.service';
import { UpdateLocationDto } from './dto/update-location.dto';
import { LobbiesService } from '../lobbies/lobbies.service';
import { SkipThrottle } from '@nestjs/throttler';

/// WebSocket Gateway managing real-time spatial node movements, lobby room subscriptions,
/// and live Spotify playback synchronization under the `/nodes` namespace.
@SkipThrottle()
@WebSocketGateway({
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
  namespace: '/api/nodes',
})
export class NodesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NodesGateway.name);

  constructor(
    private readonly nodesService: NodesService,
    private readonly jwtService: JwtService,
    private readonly lobbiesService: LobbiesService,
  ) {}

  /// Authenticates incoming Socket.io connections using JWT tokens provided in auth payload or headers.
  /// Assigns user to their personal room (`user_X`) and active spatial lobby room (`lobby_X`).
  async handleConnection(client: Socket) {
    const authToken = client.handshake.auth?.token as string | undefined;
    const authorization = client.handshake.headers.authorization;
    const token = authToken ?? authorization?.replace(/^Bearer\s+/i, '');

    if (!token) {
      this.logger.warn(
        `Unauthorized WebSocket connection attempt: ${client.id}`,
      );
      client.emit('error', { message: 'Unauthorized connection' });
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string }>(token);
      client.data.userId = payload.sub;

      const userRoom = `user_${payload.sub}`;
      client.join(userRoom);

      const lobby = await this.lobbiesService.getUserLobby(payload.sub);
      client.data.lobbyId = lobby.id;

      const roomName = `lobby_${lobby.id}`;
      client.join(roomName);

      this.logger.log(
        `Client ${client.id} (User: ${payload.sub}) joined ${roomName} and ${userRoom}`,
      );
    } catch (error: any) {
      this.logger.warn(
        `Invalid WebSocket session for client ${client.id}: ${error?.message || error}`,
      );
      client.emit('error', { message: 'Invalid token or session error' });
      client.disconnect(true);
    }
  }

  /// Handles socket disconnection lifecycle events.
  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /// Updates local user geographical location and broadcasts new position to occupants of the same lobby room.
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @SubscribeMessage('update_location')
  async handleUpdateLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() location: UpdateLocationDto,
  ) {
    if (!client.data.userId) {
      client.disconnect(true);
      return { status: 'error', message: 'Unauthorized socket session' };
    }

    const updatedNode = await this.nodesService.updateLocation(
      client.data.userId,
      location,
    );

    const targetRoom = `lobby_${updatedNode.lobbyId}`;
    this.server.to(targetRoom).emit('node_updated', {
      userId: client.data.userId,
      node: updatedNode,
    });

    return { status: 'ok', data: updatedNode };
  }

  /// Unsubscribes client from previous lobby room and joins target room upon lobby transitions.
  @SubscribeMessage('switch_lobby_room')
  async handleSwitchLobbyRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { newLobbyId: string },
  ) {
    if (!client.data.userId || !data.newLobbyId) {
      return { status: 'error', message: 'Invalid payload' };
    }

    const previousLobbyId = client.data.lobbyId;
    if (previousLobbyId) {
      client.leave(`lobby_${previousLobbyId}`);
    }

    const newRoom = `lobby_${data.newLobbyId}`;
    client.join(newRoom);
    client.data.lobbyId = data.newLobbyId;

    this.logger.log(
      `User ${client.data.userId} switched socket room from lobby_${previousLobbyId} to ${newRoom}`,
    );

    return { status: 'ok', joinedRoom: newRoom };
  }

  /// Broadcasts node updates (Spotify tracks/BPM/status) across room targets.
  broadcastNodeUpdate(userId: string, updatedNode: any) {
    const payload = {
      userId,
      node: {
        id: updatedNode.userId,
        nodeId: updatedNode.id,
        songTitle: updatedNode.songTitle,
        artist: updatedNode.artist,
        isPlaying: updatedNode.isPlaying,
        bpm: updatedNode.bpm,
        bpmEstimated: updatedNode.bpmEstimated,
        status: updatedNode.status,
        label: updatedNode.user?.username || '',
      },
    };

    if (updatedNode.lobbyId) {
      this.logger.log(
        `Broadcasting node_updated for user ${userId} to room lobby_${updatedNode.lobbyId}`,
      );
      this.server
        .to(`lobby_${updatedNode.lobbyId}`)
        .emit('node_updated', payload);
    }

    this.server.emit('node_updated', payload);
  }
}
