import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { LobbiesService } from './lobbies.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

// ============================================================================
// TEST SUITE: LobbiesService
// ============================================================================
describe('LobbiesService', () => {
  let service: LobbiesService;
  let prismaService: jest.Mocked<PrismaService>;

  // ==========================================================================
  // SETUP & INITIALIZATION
  // ==========================================================================
  beforeEach(async () => {
    // Define mock implementations for Prisma client lobby operations
    const mockPrismaService = {
      lobby: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      node: {
        findUnique: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      friendship: {
        findFirst: jest.fn(),
      },
    };

    // Compile testing module with mocked Prisma service
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LobbiesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<LobbiesService>(LobbiesService);
    prismaService = module.get(PrismaService);

    // Reset mock call histories before each test case
    jest.clearAllMocks();
  });

  // Basic sanity check to ensure service instantiation
  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ==========================================================================
  // TESTS: cleanupEmptyLobbies()
  // ==========================================================================
  describe('cleanupEmptyLobbies', () => {
    it('should delete empty lobbies containing 0 nodes successfully', async () => {
      // Arrange: mock deleteMany response
      (prismaService.lobby.deleteMany as any).mockResolvedValue({ count: 3 });

      // Act: execute cron cleanup task
      await service.cleanupEmptyLobbies();

      // Assert: verify query criteria
      expect(prismaService.lobby.deleteMany).toHaveBeenCalledWith({
        where: {
          nodes: {
            none: {},
          },
        },
      });
    });
  });

  // ==========================================================================
  // TESTS: getOrCreateAvailableLobbyForUser()
  // ==========================================================================
  describe('getOrCreateAvailableLobbyForUser', () => {
    it('should throw NotFoundException if user node entity does not exist', async () => {
      // Arrange: user node lookup returns null
      (prismaService.node.findUnique as any).mockResolvedValue(null);

      // Act & Assert: expect NotFoundException
      await expect(
        service.getOrCreateAvailableLobbyForUser('user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should assign user to an existing open lobby with capacity under 20', async () => {
      // Arrange: mock unassigned user node and available open lobby
      const mockNode = { userId: 'user-1', lobbyId: null };
      (prismaService.node.findUnique as any).mockResolvedValue(mockNode);

      const availableLobbies = [{ id: 'lobby-1', _count: { nodes: 5 } }];
      (prismaService.lobby.findMany as any).mockResolvedValue(availableLobbies);

      const lobbyDetails = {
        id: 'lobby-1',
        name: 'Test Lobby v1.0.0',
        maxCapacity: 20,
        createdAt: new Date(),
        nodes: [],
      };
      (prismaService.lobby.findUnique as any).mockResolvedValue(lobbyDetails);

      // Act: call assignment service
      const result = await service.getOrCreateAvailableLobbyForUser('user-1');

      // Assert: verify node assignment update call and returned lobby details
      expect(prismaService.node.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { lobbyId: 'lobby-1' },
      });
      expect(result.id).toEqual('lobby-1');
    });
  });

  // ==========================================================================
  // TESTS: switchLobbyToFriend()
  // ==========================================================================
  describe('switchLobbyToFriend', () => {
    it('should throw BadRequestException if switching lobby to oneself', async () => {
      // Act & Assert: expect BadRequestException
      await expect(
        service.switchLobbyToFriend('user-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if target user is not an accepted friend', async () => {
      // Arrange: friendship lookup returns null
      (prismaService.friendship.findFirst as any).mockResolvedValue(null);

      // Act & Assert: expect BadRequestException
      await expect(
        service.switchLobbyToFriend('user-1', 'user-2'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if friend lobby has reached max capacity (20)', async () => {
      // Arrange: mock accepted friendship and full lobby count (20 nodes)
      (prismaService.friendship.findFirst as any).mockResolvedValue({
        id: 'f-1',
      });
      (prismaService.node.findUnique as any).mockResolvedValue({
        lobbyId: 'lobby-full',
      });
      (prismaService.node.count as any).mockResolvedValue(20);

      // Act & Assert: expect max capacity BadRequestException
      await expect(
        service.switchLobbyToFriend('user-1', 'user-2'),
      ).rejects.toThrow("Friend's lobby has reached maximum capacity (20/20)");
    });
  });
});
