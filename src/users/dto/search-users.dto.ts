import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class SearchUsersDto {
  @ApiProperty({
    example: 'ruben',
    description: 'Username query search string',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Search query string cannot be empty' })
  @MinLength(2, { message: 'Search query must be at least 2 characters long' })
  query: string;
}
