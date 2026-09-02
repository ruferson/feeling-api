import { IsNotEmpty, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'e2e_user', description: 'Unique username' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Username is required' })
  username: string;

  @ApiProperty({ example: 'SecurePassword123!', description: 'Password' })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}
