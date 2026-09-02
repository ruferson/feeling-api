import { IsNumber, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateLocationDto {
  @ApiProperty({ example: 10.5, description: 'Updated X coordinate' })
  @Type(() => Number)
  @IsNumber({}, { message: 'posX must be a valid number' })
  @Min(-10000, { message: 'posX cannot be less than -10000' })
  @Max(10000, { message: 'posX cannot exceed 10000' })
  posX: number;

  @ApiProperty({ example: 20.0, description: 'Updated Y coordinate' })
  @Type(() => Number)
  @IsNumber({}, { message: 'posY must be a valid number' })
  @Min(-10000, { message: 'posY cannot be less than -10000' })
  @Max(10000, { message: 'posY cannot exceed 10000' })
  posY: number;

  @ApiPropertyOptional({
    example: 120,
    description: 'Optional Beats Per Minute (BPM) metric',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'bpm must be a valid number' })
  @Min(0, { message: 'bpm cannot be negative' })
  @Max(300, { message: 'bpm cannot exceed 300' })
  bpm?: number;
}
