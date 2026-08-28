import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsString,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'The provided email is invalid' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @IsNumber({}, { message: 'Initial posX must be a valid number' })
  @IsNotEmpty({ message: 'Initial posX is required' })
  posX: number;

  @IsNumber({}, { message: 'Initial posY must be a valid number' })
  @IsNotEmpty({ message: 'Initial posY is required' })
  posY: number;
}
