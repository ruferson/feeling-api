import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SpotifyAuthDto {
  @ApiProperty({
    example: 'AQD...',
    description: 'Authorization code returned by Spotify callback',
  })
  @IsString()
  @IsNotEmpty()
  code: string;
}
