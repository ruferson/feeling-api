import { IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class JoinFriendLobbyDto {
  @ApiProperty({
    example: '3dbf0d72-b8b6-464b-b92b-81ba1c7ebc62',
    description: 'UUID of the target friend whose lobby you want to join',
  })
  @IsUUID('4', { message: 'Friend ID must be a valid UUID v4' })
  @IsNotEmpty({ message: 'Friend ID is required' })
  friendId: string;
}
