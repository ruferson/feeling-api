import { IsNotEmpty, IsString } from 'class-validator';

export class SpotifyAuthDto {
  @IsString()
  @IsNotEmpty()
  code: string;
}
