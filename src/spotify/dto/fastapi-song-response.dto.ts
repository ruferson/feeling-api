import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class FastApiSongResponseDto {
  @ApiProperty({
    example: 'uuid-node-id',
    description: 'Unique identifier of the node',
  })
  @IsString()
  @IsNotEmpty()
  nodeId: string;

  @ApiProperty({ example: 'Song Title', description: 'Current song playing' })
  @IsString()
  song: string;

  @ApiProperty({
    example: 'Artist Name',
    description: 'Artist of the current song',
  })
  @IsString()
  artist: string;

  @ApiProperty({ example: true, description: 'Playback status indicator' })
  @IsBoolean()
  isPlaying: boolean;

  @ApiProperty({
    example: true,
    description: 'Synchronization status indicator',
  })
  @IsBoolean()
  synced: boolean;

  @ApiPropertyOptional({
    example: {},
    description: 'Raw Spotify playback object metadata',
  })
  @IsOptional()
  @IsObject()
  spotifyPlayback?: Record<string, unknown> | null;
}
