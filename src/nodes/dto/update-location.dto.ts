import { IsNumber, IsOptional } from 'class-validator';

export class UpdateLocationDto {
  @IsNumber()
  posX: number;

  @IsNumber()
  posY: number;

  @IsOptional()
  @IsNumber()
  bpm?: number;
}
