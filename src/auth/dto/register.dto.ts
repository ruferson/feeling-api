import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    example: 'e2e_user',
    description: 'Unique username of the user',
  })
  @IsString()
  @IsNotEmpty({ message: 'Username is required' })
  @MinLength(3, { message: 'Username must be at least 3 characters long' })
  username: string;

  @ApiProperty({
    example: 'user@example.com',
    description: 'User electronic mail address',
  })
  @IsEmail({}, { message: 'The provided email is invalid' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({
    example: 'SecurePassword123!',
    description: 'Account password',
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @ApiProperty({
    example: 0,
    description: 'Initial X coordinate for node placement',
  })
  @IsNumber({}, { message: 'Initial posX must be a valid number' })
  @IsNotEmpty({ message: 'Initial posX is required' })
  posX: number;

  @ApiProperty({
    example: 0,
    description: 'Initial Y coordinate for node placement',
  })
  @IsNumber({}, { message: 'Initial posY must be a valid number' })
  @IsNotEmpty({ message: 'Initial posY is required' })
  posY: number;
}
