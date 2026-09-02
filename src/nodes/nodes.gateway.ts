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

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'nodes',
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

  async handleConnection(client: Socket) {
    const authToken = client.handshake.auth?.token as string | undefined;
    const authorization = client.handshake.headers.authorization;
    const token = authToken ?? authorization?.replace(/^Bearer\s+/i, '');

    if (!token) {
      this.logger.warn(
        `Unauthorized WebSocket connection attempt: ${client.id}`,
      );
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string }>(token);
      client.data.userId = payload.sub;

      // Ensure user is assigned to a lobby and join the corresponding Socket.io Room
      const lobby = await this.lobbiesService.getUserLobby(payload.sub);
      client.data.lobbyId = lobby.id;

      const roomName = `lobby_${lobby.id}`;
      client.join(roomName);

      this.logger.log(
        `Client ${client.id} (User: ${payload.sub}) connected and joined room ${roomName}`,
      );
    } catch (error) {
      this.logger.warn(`Invalid WebSocket JWT token for client ${client.id}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

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

    // Emit event ONLY to clients connected to the same lobby Room
    const targetRoom = `lobby_${updatedNode.lobbyId}`;
    this.server.to(targetRoom).emit('node_updated', {
      userId: client.data.userId,
      node: updatedNode,
    });

    return { status: 'ok', data: updatedNode };
  }

  /**
   * Allows socket client to switch room when they change lobby (e.g. joining a friend)
   */
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
}
