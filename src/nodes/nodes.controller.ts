import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Request,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { NodesService } from './nodes.service';
import { UpdateLocationDto } from './dto/update-location.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('nodes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('nodes')
export class NodesController {
  constructor(private readonly nodesService: NodesService) {}

  @ApiOperation({
    summary: 'Get all active spatial nodes with privacy masking rules applied',
  })
  @ApiResponse({ status: 200, description: 'Nodes retrieved successfully.' })
  @Get()
  async findAll(@Request() req: any) {
    const userId = req.user.id ?? req.user.sub;
    return this.nodesService.findAll(userId);
  }

  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary: 'Update authenticated user node spatial coordinates',
  })
  @ApiResponse({
    status: 200,
    description: 'Node position updated successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid coordinates or boundary limit exceeded.',
  })
  @ApiResponse({ status: 429, description: 'Too Many Requests.' })
  @Patch('location')
  async updateLocation(
    @Request() req: any,
    @Body() updateLocationDto: UpdateLocationDto,
  ) {
    const userId = req.user.id ?? req.user.sub;
    return this.nodesService.updateLocation(userId, updateLocationDto);
  }

  @ApiOperation({
    summary: 'Retrieve external song details for a specific node ID',
  })
  @ApiParam({ name: 'id', description: 'Node UUID identifier' })
  @ApiResponse({
    status: 200,
    description: 'Song metadata retrieved successfully.',
  })
  @Get(':id/song')
  async getSongInfo(@Param('id', ParseUUIDPipe) id: string) {
    return this.nodesService.getSongInfoFromFastApi(id);
  }
}
