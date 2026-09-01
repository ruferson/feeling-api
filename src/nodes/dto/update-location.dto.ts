import { IsNumber, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateLocationDto {
  @ApiProperty({ example: 10.5, description: 'Updated X coordinate' })
  @IsNumber()
  posX: number;

  @ApiProperty({ example: 20.0, description: 'Updated Y coordinate' })
  @IsNumber()
  posY: number;

  @ApiPropertyOptional({
    example: 120,
    description: 'Optional Beats Per Minute (BPM) metric',
  })
  @IsOptional()
  @IsNumber()
  bpm?: number;
}
