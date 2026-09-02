import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto } from './dto/pagination-query.dto';

@Injectable()
export class FriendsService {
  constructor(private readonly prisma: PrismaService) {}

  async sendRequest(senderId: string, receiverUsername: string) {
    const receiver = await this.prisma.user.findUnique({
      where: { username: receiverUsername },
    });
    if (!receiver) {
      throw new NotFoundException('El usuario especificado no existe.');
    }

    const receiverId = receiver.id;

    if (senderId === receiverId) {
      throw new BadRequestException(
        'No puedes enviarte una solicitud a ti mismo.',
      );
    }

    const existing = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId },
        ],
      },
    });

    if (existing) {
      throw new BadRequestException(
        'Ya existe una relación o solicitud pendiente con este usuario.',
      );
    }

    return this.prisma.friendship.create({
      data: {
        senderId,
        receiverId,
        status: 'PENDING',
      },
    });
  }

  async acceptRequest(userId: string, friendshipId: string) {
    const friendship = await this.prisma.friendship.findUnique({
      where: { id: friendshipId },
    });

    if (!friendship || friendship.receiverId !== userId) {
      throw new NotFoundException('Solicitud de amistad no encontrada.');
    }

    return this.prisma.friendship.update({
      where: { id: friendshipId },
      data: { status: 'ACCEPTED' },
    });
  }

  async rejectRequest(userId: string, friendshipId: string) {
    const friendship = await this.prisma.friendship.findUnique({
      where: { id: friendshipId },
    });

    if (
      !friendship ||
      friendship.receiverId !== userId ||
      friendship.status !== 'PENDING'
    ) {
      throw new NotFoundException('Solicitud de amistad no encontrada.');
    }

    return this.prisma.friendship.delete({
      where: { id: friendshipId },
    });
  }

  async removeOrReject(userId: string, friendshipId: string) {
    const friendship = await this.prisma.friendship.findUnique({
      where: { id: friendshipId },
    });

    if (
      !friendship ||
      (friendship.senderId !== userId && friendship.receiverId !== userId)
    ) {
      throw new NotFoundException('Relación no encontrada.');
    }

    return this.prisma.friendship.delete({
      where: { id: friendshipId },
    });
  }

  async getFriends(userId: string, pagination?: PaginationQueryDto) {
    const page = pagination?.page ?? 1;
    const limit = Math.min(pagination?.limit ?? 10, 50);
    const skip = (page - 1) * limit;

    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      take: limit,
      skip: skip,
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            spotifyDisplayName: true,
            node: true,
          },
        },
        receiver: {
          select: {
            id: true,
            username: true,
            spotifyDisplayName: true,
            node: true,
          },
        },
      },
    });

    return friendships.map((f) => {
      const friend = f.senderId === userId ? f.receiver : f.sender;
      return {
        friendshipId: f.id,
        ...friend,
      };
    });
  }

  async getSentRequests(userId: string, pagination?: PaginationQueryDto) {
    const page = pagination?.page ?? 1;
    const limit = Math.min(pagination?.limit ?? 10, 50);
    const skip = (page - 1) * limit;

    return this.prisma.friendship.findMany({
      where: {
        senderId: userId,
        status: 'PENDING',
      },
      take: limit,
      skip: skip,
      include: {
        receiver: {
          select: { id: true, username: true, spotifyDisplayName: true },
        },
      },
    });
  }

  async getPendingRequests(userId: string, pagination?: PaginationQueryDto) {
    const page = pagination?.page ?? 1;
    const limit = Math.min(pagination?.limit ?? 10, 50);
    const skip = (page - 1) * limit;

    return this.prisma.friendship.findMany({
      where: {
        receiverId: userId,
        status: 'PENDING',
      },
      take: limit,
      skip: skip,
      include: {
        sender: {
          select: { id: true, username: true, spotifyDisplayName: true },
        },
      },
    });
  }
}
