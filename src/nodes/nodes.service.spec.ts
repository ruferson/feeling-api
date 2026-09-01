import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { NodesService } from './nodes.service';
import { PrismaService } from '../prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { NotFoundException } from '@nestjs/common';
import { of, throwError } from 'rxjs';

// ============================================================================
// TEST SUITE: NodesService
// ============================================================================
describe('NodesService', () => {
  let service: NodesService;
  let prismaService: jest.Mocked<PrismaService>;
  let httpService: jest.Mocked<HttpService>;

  // ==========================================================================
  // SETUP & INITIALIZATION
  // ==========================================================================
  beforeEach(async () => {
    // Define mock implementations for Prisma and Http services
    const mockPrismaService = {
      friendship: {
        findMany: jest.fn(),
      },
      node: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const mockHttpService = {
      get: jest.fn(),
    };

    // Compile the NestJS testing module with mocked dependencies
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NodesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
      ],
    }).compile();

    service = module.get<NodesService>(NodesService);
    prismaService = module.get(PrismaService);
    httpService = module.get(HttpService);

    // Reset mock call histories before each individual test case
    jest.clearAllMocks();
  });

  // Basic sanity check to ensure the service is properly instantiated
  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ==========================================================================
  // TESTS: findAll()
  // ==========================================================================
  describe('findAll', () => {
    const requestingUserId = 'user-1';

    it('should return nodes with visible Spotify details for owner and friends, and masked details for strangers', async () => {
      // Arrange: mock accepted friendships (user-2 is a friend, user-3 is not)
      const friendships: any[] = [
        {
          id: 'f-1',
          senderId: requestingUserId,
          receiverId: 'user-2',
          status: 'ACCEPTED',
        },
      ];
      (prismaService.friendship.findMany as any).mockResolvedValue(friendships);

      // Arrange: mock nodes list in database
      const nodes: any[] = [
        {
          userId: 'user-1',
          posX: 10,
          posY: 20,
          bpm: 120,
          bpmEstimated: false,
          isPlaying: true,
          songTitle: 'Song A',
          artist: 'Artist A',
          user: { id: 'user-1', username: 'ruben' },
        },
        {
          userId: 'user-2',
          posX: 15,
          posY: 25,
          bpm: 130,
          bpmEstimated: true,
          isPlaying: false,
          songTitle: 'Song B',
          artist: 'Artist B',
          user: { id: 'user-2', username: 'friend' },
        },
        {
          userId: 'user-3',
          posX: 30,
          posY: 40,
          bpm: 140,
          bpmEstimated: false,
          isPlaying: true,
          songTitle: 'Song C',
          artist: 'Artist C',
          user: { id: 'user-3', username: 'stranger' },
        },
      ];
      (prismaService.node.findMany as any).mockResolvedValue(nodes);

      // Act: execute findAll
      const result = await service.findAll(requestingUserId);

      // Assert: verify proper visibility flags based on relationship status
      expect(result).toEqual([
        {
          id: 'user-1',
          label: 'ruben',
          posX: 10,
          posY: 20,
          status: 'ACTIVE',
          bpm: 120,
          bpmEstimated: false,
          isPlaying: true,
          songTitle: 'Song A',
          artist: 'Artist A',
        },
        {
          id: 'user-2',
          label: 'friend',
          posX: 15,
          posY: 25,
          status: 'ACTIVE',
          bpm: 130,
          bpmEstimated: true,
          isPlaying: false,
          songTitle: 'Song B',
          artist: 'Artist B',
        },
        {
          id: 'user-3',
          label: 'stranger',
          posX: 30,
          posY: 40,
          status: 'ACTIVE',
          bpm: 0,
          bpmEstimated: false,
          isPlaying: false,
          songTitle: '',
          artist: '',
        },
      ]);
    });
  });

  // ==========================================================================
  // TESTS: updateLocation()
  // ==========================================================================
  describe('updateLocation', () => {
    const userId = 'user-1';
    const updateDto = { posX: 50.5, posY: 60.6, bpm: 125 };

    it('should successfully update node coordinates and optional bpm when node exists', async () => {
      // Arrange: node exists in database
      const existingNode = { userId, posX: 10, posY: 10, bpm: 100 };
      const updatedNode = { userId, posX: 50.5, posY: 60.6, bpm: 125 };
      (prismaService.node.findUnique as any).mockResolvedValue(existingNode);
      (prismaService.node.update as any).mockResolvedValue(updatedNode);

      // Act: execute updateLocation
      const result = await service.updateLocation(userId, updateDto);

      // Assert: verify prisma update query arguments and result
      expect(prismaService.node.findUnique).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(prismaService.node.update).toHaveBeenCalledWith({
        where: { userId },
        data: { posX: 50.5, posY: 60.6, bpm: 125 },
      });
      expect(result).toEqual(updatedNode);
    });

    it('should throw NotFoundException if node does not exist for the user', async () => {
      // Arrange: node lookup returns null
      (prismaService.node.findUnique as any).mockResolvedValue(null);

      // Act & Assert: expect NotFoundException
      await expect(service.updateLocation(userId, updateDto)).rejects.toThrow(
        new NotFoundException('Node not found for this user'),
      );
      expect(prismaService.node.update).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // TESTS: getSongInfoFromFastApi()
  // ==========================================================================
  describe('getSongInfoFromFastApi', () => {
    const nodeId = 'node-123';

    it('should fetch and return song info data from FastAPI successfully', async () => {
      // Arrange: mock successful HttpService get response
      const apiResponse = {
        data: { song: 'Shape of You', artist: 'Ed Sheeran', synced: true },
      };
      (httpService.get as jest.Mock).mockReturnValue(of(apiResponse));

      // Act: fetch song info
      const result = await service.getSongInfoFromFastApi(nodeId);

      // Assert: verify http get call and returned data
      expect(httpService.get).toHaveBeenCalledWith(
        `http://localhost:8000/nodes/${nodeId}/song`,
      );
      expect(result).toEqual(apiResponse.data);
    });

    it('should fallback to default unknown song object if FastAPI request fails', async () => {
      // Arrange: mock failed HttpService request throwing an error
      (httpService.get as jest.Mock).mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      // Act: fetch song info
      const result = await service.getSongInfoFromFastApi(nodeId);

      // Assert: verify fallback response structure
      expect(result).toEqual({
        song: 'Unknown',
        artist: 'Unknown',
        synced: false,
      });
    });
  });
});
