import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class SendRequestDto {
  @ApiProperty({
    example: 'target_username',
    description: 'Username of the user to send a friend request to',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Target username is required' })
  @MinLength(3, { message: 'Username must be at least 3 characters long' })
  username: string;
}
