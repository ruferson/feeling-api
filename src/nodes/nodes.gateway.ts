import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { UsePipes, ValidationPipe } from '@nestjs/common';
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

  constructor(
    private readonly nodesService: NodesService,
    private readonly jwtService: JwtService,
  ) {}

  async handleConnection(client: Socket) {
    const authToken = client.handshake.auth?.token as string | undefined;
    const authorization = client.handshake.headers.authorization;
    const token = authToken ?? authorization?.replace(/^Bearer\s+/i, '');

    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string }>(token);
      client.data.userId = payload.sub;
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(_client: Socket) {}

  @UsePipes(new ValidationPipe({ transform: true }))
  @SubscribeMessage('update_location')
  async handleUpdateLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() location: UpdateLocationDto,
  ) {
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
