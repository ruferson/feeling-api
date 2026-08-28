import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Request,
  UseGuards,
} from '@nestjs/common';
import { NodesService } from './nodes.service';
import { UpdateLocationDto } from './dto/update-location.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('nodes')
export class NodesController {
  constructor(private readonly nodesService: NodesService) {}

  // Endpoint necesario para obtener todos los nodos activos
  @Get()
  async findAll() {
    return this.nodesService.findAll();
  }

  @Patch('location')
  async updateLocation(
    @Request() req: any,
    @Body() updateLocationDto: UpdateLocationDto,
  ) {
    return this.nodesService.updateLocation(req.user.id, updateLocationDto);
  }

  @Get(':id/song')
  async getSongInfo(@Param('id') id: string) {
    return this.nodesService.getSongInfoFromFastApi(id);
  }
}
