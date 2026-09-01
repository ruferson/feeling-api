import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FastApiSongResponseDto {
  @ApiProperty({
    example: 'uuid-node-id',
    description: 'Unique identifier of the node',
  })
  nodeId: string;

  @ApiProperty({ example: 'Song Title', description: 'Current song playing' })
  song: string;

  @ApiProperty({
    example: 'Artist Name',
    description: 'Artist of the current song',
  })
  artist: string;

  @ApiProperty({ example: true, description: 'Playback status indicator' })
  isPlaying: boolean;

  @ApiProperty({
    example: true,
    description: 'Synchronization status indicator',
  })
  synced: boolean;

  @ApiPropertyOptional({
    example: {},
    description: 'Raw Spotify playback object metadata',
  })
  spotifyPlayback?: Record<string, unknown> | null;
}
