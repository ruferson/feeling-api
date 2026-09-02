import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { FriendsService } from './friends.service';
import { PrismaService } from '../prisma/prisma.service';
import { FriendsGateway } from './friends.gateway';
import { NotFoundException, BadRequestException } from '@nestjs/common';

// ============================================================================
// TEST SUITE: FriendsService
// ============================================================================
describe('FriendsService', () => {
  let service: FriendsService;
  let prismaService: jest.Mocked<PrismaService>;
  let friendsGateway: jest.Mocked<FriendsGateway>;

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

    // Define mock implementations for FriendsGateway methods
    const mockFriendsGateway = {
      emitFriendRequest: jest.fn(),
      emitFriendshipAccepted: jest.fn(),
      emitFriendshipRemoved: jest.fn(),
    };

    // Compile the NestJS testing module with mocked Prisma and FriendsGateway providers
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FriendsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: FriendsGateway,
          useValue: mockFriendsGateway,
        },
      ],
    }).compile();

    service = module.get<FriendsService>(FriendsService);
    prismaService = module.get(PrismaService) as jest.Mocked<PrismaService>;
    friendsGateway = module.get(FriendsGateway) as jest.Mocked<FriendsGateway>;

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
        sender: {
          id: senderId,
          username: 'me',
          spotifyDisplayName: 'Me',
        },
      };
      prismaService.friendship.create.mockResolvedValue(
        createdFriendship as any,
      );

      // Act: execute sendRequest
      const result = await service.sendRequest(senderId, receiverUsername);

      // Assert: verify prisma calls, websocket emission, and created output
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { username: receiverUsername },
        select: { id: true },
      });
      expect(prismaService.friendship.findFirst).toHaveBeenCalled();
      expect(prismaService.friendship.create as jest.Mock).toHaveBeenCalledWith(
        {
          data: { senderId, receiverId: receiver.id, status: 'PENDING' },
          include: {
            sender: {
              select: { id: true, username: true, spotifyDisplayName: true },
            },
          },
        },
      );
      expect(friendsGateway.emitFriendRequest).toHaveBeenCalledWith(
        receiver.id,
        {
          friendshipId: createdFriendship.id,
          senderId: createdFriendship.senderId,
          username: createdFriendship.sender.username,
          spotifyDisplayName: createdFriendship.sender.spotifyDisplayName,
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
        new NotFoundException('The specified user does not exist.'),
      );
    });

    it('should throw BadRequestException if user tries to send request to themselves', async () => {
      // Arrange: receiver username maps to sender's own user ID
      const selfUser = { id: senderId };
      prismaService.user.findUnique.mockResolvedValue(selfUser as any);

      // Act & Assert: expect BadRequestException for self-request
      await expect(service.sendRequest(senderId, 'ruben')).rejects.toThrow(
        new BadRequestException(
          'You cannot send a friend request to yourself.',
        ),
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
          'A friendship or pending request already exists with this user.',
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
      // Arrange: friendship exists, status is PENDING, and target user is the intended receiver
      const existingFriendship = {
        id: friendshipId,
        senderId: 'user-1',
        receiverId: userId,
        status: 'PENDING',
      };
      prismaService.friendship.findUnique.mockResolvedValue(
        existingFriendship as any,
      );
      const updatedFriendship = {
        id: friendshipId,
        senderId: 'user-1',
        receiverId: userId,
        status: 'ACCEPTED',
        receiver: {
          id: userId,
          username: 'amigo',
          spotifyDisplayName: 'Amigo',
        },
      };
      prismaService.friendship.update.mockResolvedValue(
        updatedFriendship as any,
      );

      // Act: accept request
      const result = await service.acceptRequest(userId, friendshipId);

      // Assert: verify status update in database and websocket emission
      expect(prismaService.friendship.findUnique).toHaveBeenCalledWith({
        where: { id: friendshipId },
        select: { id: true, receiverId: true, status: true },
      });
      expect(prismaService.friendship.update as jest.Mock).toHaveBeenCalledWith(
        {
          where: { id: friendshipId },
          data: { status: 'ACCEPTED' },
          include: {
            receiver: {
              select: { id: true, username: true, spotifyDisplayName: true },
            },
          },
        },
      );
      expect(friendsGateway.emitFriendshipAccepted).toHaveBeenCalledWith(
        updatedFriendship.senderId,
        {
          friendshipId: updatedFriendship.id,
          friendUserId: updatedFriendship.receiverId,
          username: updatedFriendship.receiver.username,
          spotifyDisplayName: updatedFriendship.receiver.spotifyDisplayName,
        },
      );
      expect(result).toEqual(updatedFriendship);
    });

    it('should throw NotFoundException if friendship does not exist or user is not the receiver', async () => {
      // Arrange: friendship not found or mismatch user receiver
      prismaService.friendship.findUnique.mockResolvedValue(null);

      // Act & Assert: expect NotFoundException
      await expect(service.acceptRequest(userId, friendshipId)).rejects.toThrow(
        new NotFoundException('Pending friend request not found.'),
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

      // Assert: verify deletion call and websocket emission
      expect(prismaService.friendship.delete).toHaveBeenCalledWith({
        where: { id: friendshipId },
      });
      expect(friendsGateway.emitFriendshipRemoved).toHaveBeenCalledWith(
        existingFriendship.senderId,
        {
          friendshipId: existingFriendship.id,
          removedByUserId: userId,
        },
      );
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
        new NotFoundException('Pending friend request not found.'),
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

      // Assert: verify deletion and websocket emission to other party
      expect(prismaService.friendship.delete).toHaveBeenCalledWith({
        where: { id: friendshipId },
      });
      expect(friendsGateway.emitFriendshipRemoved).toHaveBeenCalledWith(
        friendship.receiverId,
        {
          friendshipId: friendship.id,
          removedByUserId: userId,
        },
      );
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
      ).rejects.toThrow(
        new NotFoundException('Friendship relation not found.'),
      );
    });
  });

  // ==========================================================================
  // TESTS: getFriends()
  // ==========================================================================
  describe('getFriends', () => {
    const userId = 'user-1';

    it('should return list of mapped accepted friends using default pagination parameters', async () => {
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

      // Act: get friends list without explicit pagination
      const result = await service.getFriends(userId);

      // Assert: verify mapped result and default pagination args (take: 10, skip: 0)
      expect(prismaService.friendship.findMany).toHaveBeenCalledWith({
        where: {
          status: 'ACCEPTED',
          OR: [{ senderId: userId }, { receiverId: userId }],
        },
        take: 10,
        skip: 0,
        include: expect.any(Object),
      });
      expect(result).toEqual([
        {
          friendshipId: 'f-1',
          userId: 'user-2',
          username: 'friend1',
          spotifyDisplayName: 'Friend 1',
          node: null,
        },
      ]);
    });

    it('should calculate take and skip correctly when pagination parameters are provided', async () => {
      // Arrange: custom page and limit query
      const pagination = { page: 2, limit: 20 };
      prismaService.friendship.findMany.mockResolvedValue([]);

      // Act: get friends list with page 2 and limit 20
      await service.getFriends(userId, pagination);

      // Assert: verify take is 20 and skip is 20 ((page 2 - 1) * 20)
      expect(prismaService.friendship.findMany).toHaveBeenCalledWith({
        where: {
          status: 'ACCEPTED',
          OR: [{ senderId: userId }, { receiverId: userId }],
        },
        take: 20,
        skip: 20,
        include: expect.any(Object),
      });
    });
  });

  // ==========================================================================
  // TESTS: getSentRequests() & getPendingRequests()
  // ==========================================================================
  describe('getSentRequests', () => {
    it('should return pending requests sent by user with pagination', async () => {
      // Arrange: mock sent pending requests query
      const sentRequests: any[] = [
        {
          id: 'f-1',
          senderId: 'user-1',
          status: 'PENDING',
          createdAt: new Date(),
          receiver: {
            id: 'user-2',
            username: 'friend1',
            spotifyDisplayName: 'Friend 1',
          },
        },
      ];
      prismaService.friendship.findMany.mockResolvedValue(sentRequests);

      // Act: fetch sent requests
      const result = await service.getSentRequests('user-1', {
        page: 1,
        limit: 10,
      });

      // Assert: verify query parameters and mapped response
      expect(
        prismaService.friendship.findMany as jest.Mock,
      ).toHaveBeenCalledWith({
        where: { senderId: 'user-1', status: 'PENDING' },
        take: 10,
        skip: 0,
        include: expect.any(Object),
      });
      expect(result).toEqual([
        {
          id: sentRequests[0].id,
          friendshipId: sentRequests[0].id,
          userId: 'user-2',
          username: 'friend1',
          spotifyDisplayName: 'Friend 1',
          createdAt: sentRequests[0].createdAt,
        },
      ]);
    });
  });

  describe('getPendingRequests', () => {
    it('should return pending requests received by user with pagination', async () => {
      // Arrange: mock received pending requests query
      const pendingRequests: any[] = [
        {
          id: 'f-2',
          receiverId: 'user-1',
          status: 'PENDING',
          createdAt: new Date(),
          sender: {
            id: 'user-3',
            username: 'friend2',
            spotifyDisplayName: 'Friend 2',
          },
        },
      ];
      prismaService.friendship.findMany.mockResolvedValue(pendingRequests);

      // Act: fetch pending requests
      const result = await service.getPendingRequests('user-1', {
        page: 1,
        limit: 10,
      });

      // Assert: verify query parameters and mapped response
      expect(
        prismaService.friendship.findMany as jest.Mock,
      ).toHaveBeenCalledWith({
        where: { receiverId: 'user-1', status: 'PENDING' },
        take: 10,
        skip: 0,
        include: expect.any(Object),
      });
      expect(result).toEqual([
        {
          id: pendingRequests[0].id,
          friendshipId: pendingRequests[0].id,
          userId: 'user-3',
          username: 'friend2',
          spotifyDisplayName: 'Friend 2',
          createdAt: pendingRequests[0].createdAt,
        },
      ]);
    });
  });
});
