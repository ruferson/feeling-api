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

  @Get()
  async findAll(@Request() req: any) {
    const userId = req.user.id ?? req.user.sub;
    return this.nodesService.findAll(userId);
  }

  @Patch('location')
  async updateLocation(
    @Request() req: any,
    @Body() updateLocationDto: UpdateLocationDto,
  ) {
    const userId = req.user.id ?? req.user.sub;
    return this.nodesService.updateLocation(userId, updateLocationDto);
  }

  @Get(':id/song')
  async getSongInfo(@Param('id') id: string) {
    return this.nodesService.getSongInfoFromFastApi(id);
  }
}
