import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from '../auth/dto/register.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(registerDto: RegisterDto) {
    return this.prisma.user.create({
      data: {
        email: registerDto.email,
        password: registerDto.password,
        // Nested write: Creates the associated Node automatically in the same transaction
        node: {
          create: {
            posX: registerDto.posX,
            posY: registerDto.posY,
            bpm: 0,
            status: 'IDLE',
          },
        },
      },
      include: {
        node: true, // Includes the node object in the returned query
      },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        node: true,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        createdAt: true,
        updatedAt: true,
        node: true,
      },
    });
  }
}
