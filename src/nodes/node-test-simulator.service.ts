import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NodesGateway } from './nodes.gateway';

@Injectable()
export class NodeTestSimulatorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NodeTestSimulatorService.name);
  private timer: NodeJS.Timeout | null = null;

  private readonly TARGET_USER_ID = '3dbf0d72-b8b6-464b-b92b-81ba1c7ebc62';
  private readonly MIN_LNG = -180.0;
  private readonly MAX_LNG = 180.0;
  private readonly MIN_LAT = -90.0;
  private readonly MAX_LAT = 90.0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly nodesGateway: NodesGateway,
  ) {}

  onModuleInit(): void {
    // Intentionally disabled for the prototype runtime.
  }

  onModuleDestroy(): void {
    this.stopSimulation();
  }

  startSimulation(): void {
    this.timer = setInterval(async () => {
      await this.moveNodeToRandomPosition();
    }, 5000);
  }

  stopSimulation(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async moveNodeToRandomPosition(): Promise<void> {
    try {
      const randomLng = Number(
        (Math.random() * (this.MAX_LNG - this.MIN_LNG) + this.MIN_LNG).toFixed(
          6,
        ),
      );
      const randomLat = Number(
        (Math.random() * (this.MAX_LAT - this.MIN_LAT) + this.MIN_LAT).toFixed(
          6,
        ),
      );

      const updatedNode = await this.prisma.node.update({
        where: { userId: this.TARGET_USER_ID },
        data: {
          posX: randomLng,
          posY: randomLat,
        },
      });

      this.nodesGateway.server.emit('node_updated', {
        userId: this.TARGET_USER_ID,
        node: updatedNode,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to simulate movement for node ${this.TARGET_USER_ID}: ${errorMessage}`,
      );
    }
  }
}
