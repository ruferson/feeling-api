import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PassportModule } from '@nestjs/passport';
import { NodesService } from './nodes.service';
import { NodesController } from './nodes.controller';
import { AuthModule } from '../auth/auth.module';
import { NodesGateway } from './nodes.gateway';
import { NodeTestSimulatorService } from './node-test-simulator.service';

@Module({
  imports: [HttpModule, PassportModule, AuthModule],
  controllers: [NodesController],
  providers: [NodesService, NodesGateway, NodeTestSimulatorService],
  exports: [NodesService],
})
export class NodesModule {}
