import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { FriendsService } from './friends.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

// ============================================================================
// TEST SUITE: FriendsService
// ============================================================================
describe('FriendsService', () => {
  let service: FriendsService;
  let prismaService: jest.Mocked<PrismaService>;

  // ==========================================================================
  // SETUP & INITIALIZATION
  // ==========================================================================
  beforeEach(async () => {
    // Define mock implementations for Prisma methods used across friends service
    const mockPrismaService = {
      user: {
        findUnique: jest.fn(),
      },
      friendship: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    // Compile the NestJS testing module with mocked Prisma provider
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FriendsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<FriendsService>(FriendsService);
    prismaService = module.get(PrismaService) as jest.Mocked<PrismaService>;

    // Reset mock call histories before each individual test case
    jest.clearAllMocks();
  });

  // Basic sanity check to ensure the service is properly instantiated
  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ==========================================================================
  // TESTS: sendRequest()
  // ==========================================================================
  describe('sendRequest', () => {
    const senderId = 'user-1';
    const receiverUsername = 'amigo';
    const receiver = { id: 'user-2', username: 'amigo' };

    it('should successfully send a friend request when target user exists and no relation exists', async () => {
      // Arrange: target user exists, no previous friendship, create new record
      prismaService.user.findUnique.mockResolvedValue(receiver as any);
      prismaService.friendship.findFirst.mockResolvedValue(null as any);
      const createdFriendship = {
        id: 'f-1',
        senderId,
        receiverId: receiver.id,
        status: 'PENDING',
      };
      prismaService.friendship.create.mockResolvedValue(
        createdFriendship as any,
      );

      // Act: execute sendRequest
      const result = await service.sendRequest(senderId, receiverUsername);

      // Assert: verify prisma calls and created output
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { username: receiverUsername },
      });
      expect(prismaService.friendship.findFirst).toHaveBeenCalled();
      expect(prismaService.friendship.create as jest.Mock).toHaveBeenCalledWith(
        {
          data: { senderId, receiverId: receiver.id, status: 'PENDING' },
        },
      );
      expect(result).toEqual(createdFriendship);
    });

    it('should throw NotFoundException if receiver user does not exist', async () => {
      // Arrange: receiver lookup returns null
      prismaService.user.findUnique.mockResolvedValue(null as any);

      // Act & Assert: expect NotFoundException
      await expect(
        service.sendRequest(senderId, 'nonexistent'),
      ).rejects.toThrow(
        new NotFoundException('El usuario especificado no existe.'),
      );
    });

    it('should throw BadRequestException if user tries to send request to themselves', async () => {
      // Arrange: receiver username maps to sender's own user ID
      const selfUser = { id: senderId, username: 'ruben' };
      prismaService.user.findUnique.mockResolvedValue(selfUser as any);

      // Act & Assert: expect BadRequestException for self-request
      await expect(service.sendRequest(senderId, 'ruben')).rejects.toThrow(
        new BadRequestException('No puedes enviarte una solicitud a ti mismo.'),
      );
    });

    it('should throw BadRequestException if a friendship or pending request already exists', async () => {
      // Arrange: receiver exists, but active/pending friendship record is already found
      prismaService.user.findUnique.mockResolvedValue(receiver as any);
      prismaService.friendship.findFirst.mockResolvedValue({
        id: 'f-existing',
      } as any);

      // Act & Assert: expect BadRequestException due to duplication
      await expect(
        service.sendRequest(senderId, receiverUsername),
      ).rejects.toThrow(
        new BadRequestException(
          'Ya existe una relación o solicitud pendiente con este usuario.',
        ),
      );
    });
  });

  // ==========================================================================
  // TESTS: acceptRequest()
  // ==========================================================================
  describe('acceptRequest', () => {
    const userId = 'user-2';
    const friendshipId = 'f-1';

    it('should successfully accept a pending friend request', async () => {
      // Arrange: friendship exists and target user is the intended receiver
      const existingFriendship = {
        id: friendshipId,
        senderId: 'user-1',
        receiverId: userId,
        status: 'PENDING',
      };
      prismaService.friendship.findUnique.mockResolvedValue(
        existingFriendship as any,
      );
      const updatedFriendship = { ...existingFriendship, status: 'ACCEPTED' };
      prismaService.friendship.update.mockResolvedValue(
        updatedFriendship as any,
      );

      // Act: accept request
      const result = await service.acceptRequest(userId, friendshipId);

      // Assert: verify status update in database
      expect(prismaService.friendship.findUnique).toHaveBeenCalledWith({
        where: { id: friendshipId },
      });
      expect(prismaService.friendship.update as jest.Mock).toHaveBeenCalledWith(
        {
          where: { id: friendshipId },
          data: { status: 'ACCEPTED' },
        },
      );
      expect(result).toEqual(updatedFriendship);
    });

    it('should throw NotFoundException if friendship does not exist or user is not the receiver', async () => {
      // Arrange: friendship not found or mismatch user receiver
      prismaService.friendship.findUnique.mockResolvedValue(null);

      // Act & Assert: expect NotFoundException
      await expect(service.acceptRequest(userId, friendshipId)).rejects.toThrow(
        new NotFoundException('Solicitud de amistad no encontrada.'),
      );
    });
  });

  // ==========================================================================
  // TESTS: rejectRequest()
  // ==========================================================================
  describe('rejectRequest', () => {
    const userId = 'user-2';
    const friendshipId = 'f-1';

    it('should successfully delete/reject a pending friend request', async () => {
      // Arrange: valid pending friendship where user is receiver
      const existingFriendship = {
        id: friendshipId,
        senderId: 'user-1',
        receiverId: userId,
        status: 'PENDING',
      };
      prismaService.friendship.findUnique.mockResolvedValue(
        existingFriendship as any,
      );
      prismaService.friendship.delete.mockResolvedValue(
        existingFriendship as any,
      );

      // Act: reject request
      const result = await service.rejectRequest(userId, friendshipId);

      // Assert: verify deletion call
      expect(prismaService.friendship.delete).toHaveBeenCalledWith({
        where: { id: friendshipId },
      });
      expect(result).toEqual(existingFriendship);
    });

    it('should throw NotFoundException if request is not pending or user is unauthorized', async () => {
      // Arrange: status is not PENDING
      const acceptedFriendship = {
        id: friendshipId,
        senderId: 'user-1',
        receiverId: userId,
        status: 'ACCEPTED',
      };
      prismaService.friendship.findUnique.mockResolvedValue(
        acceptedFriendship as any,
      );

      // Act & Assert: expect NotFoundException
      await expect(service.rejectRequest(userId, friendshipId)).rejects.toThrow(
        new NotFoundException('Solicitud de amistad no encontrada.'),
      );
    });
  });

  // ==========================================================================
  // TESTS: removeOrReject()
  // ==========================================================================
  describe('removeOrReject', () => {
    const userId = 'user-1';
    const friendshipId = 'f-1';

    it('should successfully delete relationship if user is either sender or receiver', async () => {
      // Arrange: user is sender of the relationship
      const friendship = {
        id: friendshipId,
        senderId: userId,
        receiverId: 'user-2',
        status: 'ACCEPTED',
      };
      prismaService.friendship.findUnique.mockResolvedValue(friendship as any);
      prismaService.friendship.delete.mockResolvedValue(friendship as any);

      // Act: remove relationship
      const result = await service.removeOrReject(userId, friendshipId);

      // Assert: verify deletion
      expect(prismaService.friendship.delete).toHaveBeenCalledWith({
        where: { id: friendshipId },
      });
      expect(result).toEqual(friendship);
    });

    it('should throw NotFoundException if user is not part of the friendship relationship', async () => {
      // Arrange: user is neither sender nor receiver
      const friendship = {
        id: friendshipId,
        senderId: 'user-3',
        receiverId: 'user-2',
        status: 'ACCEPTED',
      };
      prismaService.friendship.findUnique.mockResolvedValue(friendship as any);

      // Act & Assert: expect NotFoundException
      await expect(
        service.removeOrReject(userId, friendshipId),
      ).rejects.toThrow(new NotFoundException('Relación no encontrada.'));
    });
  });

  // ==========================================================================
  // TESTS: getFriends()
  // ==========================================================================
  describe('getFriends', () => {
    const userId = 'user-1';

    it('should return list of mapped accepted friends', async () => {
      // Arrange: mock multiple friendships with sender/receiver details
      const friendships: any[] = [
        {
          id: 'f-1',
          senderId: userId,
          receiverId: 'user-2',
          status: 'ACCEPTED',
          sender: {
            id: userId,
            username: 'me',
            spotifyDisplayName: 'Me',
            node: null,
          },
          receiver: {
            id: 'user-2',
            username: 'friend1',
            spotifyDisplayName: 'Friend 1',
            node: null,
          },
        },
      ];
      prismaService.friendship.findMany.mockResolvedValue(friendships);

      // Act: get friends list
      const result = await service.getFriends(userId);

      // Assert: verify mapped result where friend details are extracted correctly
      expect(prismaService.friendship.findMany).toHaveBeenCalledWith({
        where: {
          status: 'ACCEPTED',
          OR: [{ senderId: userId }, { receiverId: userId }],
        },
        include: expect.any(Object),
      });
      expect(result).toEqual([
        {
          friendshipId: 'f-1',
          id: 'user-2',
          username: 'friend1',
          spotifyDisplayName: 'Friend 1',
          node: null,
        },
      ]);
    });
  });

  // ==========================================================================
  // TESTS: getSentRequests() & getPendingRequests()
  // ==========================================================================
  describe('getSentRequests', () => {
    it('should return pending requests sent by user', async () => {
      // Arrange: mock sent pending requests query
      const sentRequests: any[] = [
        { id: 'f-1', senderId: 'user-1', status: 'PENDING' },
      ];
      prismaService.friendship.findMany.mockResolvedValue(sentRequests);

      // Act: fetch sent requests
      const result = await service.getSentRequests('user-1');

      // Assert: verify query parameters and response
      expect(
        prismaService.friendship.findMany as jest.Mock,
      ).toHaveBeenCalledWith({
        where: { senderId: 'user-1', status: 'PENDING' },
        include: expect.any(Object),
      });
      expect(result).toEqual(sentRequests);
    });
  });

  describe('getPendingRequests', () => {
    it('should return pending requests received by user', async () => {
      // Arrange: mock received pending requests query
      const pendingRequests: any[] = [
        { id: 'f-2', receiverId: 'user-1', status: 'PENDING' },
      ];
      prismaService.friendship.findMany.mockResolvedValue(pendingRequests);

      // Act: fetch pending requests
      const result = await service.getPendingRequests('user-1');

      // Assert: verify query parameters and response
      expect(
        prismaService.friendship.findMany as jest.Mock,
      ).toHaveBeenCalledWith({
        where: { receiverId: 'user-1', status: 'PENDING' },
        include: expect.any(Object),
      });
      expect(result).toEqual(pendingRequests);
    });
  });
});
