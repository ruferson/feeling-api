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

    this.server.emit('node_updated', {
      userId: client.data.userId,
      node: updatedNode,
    });

    return { status: 'ok', data: updatedNode };
  }
}
