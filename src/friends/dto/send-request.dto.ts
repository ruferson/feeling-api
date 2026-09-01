import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendRequestDto {
  @ApiProperty({
    example: 'target_username',
    description: 'Username of the user to send a friend request to',
  })
  @IsString()
  @IsNotEmpty()
  username: string;
}
