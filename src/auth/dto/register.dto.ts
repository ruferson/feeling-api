import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsString,
  MinLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'e2e_user', description: 'Unique username' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Username is required' })
  @MinLength(3, { message: 'Username must be at least 3 characters long' })
  username: string;

  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
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
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'Password is too weak. It must contain upper and lower case letters and digits/special characters.',
  })
  password: string;

  @ApiProperty({ example: 0, description: 'Initial X coordinate' })
  @IsNumber({}, { message: 'Initial posX must be a valid number' })
  @IsNotEmpty({ message: 'Initial posX is required' })
  posX: number;

  @ApiProperty({ example: 0, description: 'Initial Y coordinate' })
  @IsNumber({}, { message: 'Initial posY is required' })
  @IsNotEmpty({ message: 'Initial posY is required' })
  posY: number;
}
