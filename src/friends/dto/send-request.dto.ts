import { IsString, IsNotEmpty } from 'class-validator';

export class SendRequestDto {
  @IsString()
  @IsNotEmpty()
  username: string;
}
