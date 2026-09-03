import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { SpotifySyncService } from './spotify-sync.service';
import { PrismaService } from '../prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { NodesGateway } from '../nodes/nodes.gateway';
import { Logger } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { NodeStatus } from '@prisma/client';

// ============================================================================
// TEST SUITE: SpotifySyncService
// ============================================================================
describe('SpotifySyncService', () => {
  let service: SpotifySyncService;
  let prismaService: jest.Mocked<PrismaService>;
  let httpService: jest.Mocked<HttpService>;
  let nodesGateway: jest.Mocked<NodesGateway>;

  // ==========================================================================
  // SETUP & INITIALIZATION
  // ==========================================================================
  beforeEach(async () => {
    // Suppress Logger error/warn output during intentional error simulation tests
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

    // Define mock implementations for Prisma, Http, and Gateway services
    const mockPrismaService = {
      node: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };

    const mockHttpService = {
      get: jest.fn(),
    };

    const mockNodesGateway = {
      broadcastNodeUpdate: jest.fn(),
    };

    // Compile the NestJS testing module with mocked dependencies
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpotifySyncService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: NodesGateway,
          useValue: mockNodesGateway,
        },
      ],
    }).compile();

    service = module.get<SpotifySyncService>(SpotifySyncService);
    prismaService = module.get(PrismaService);
    httpService = module.get(HttpService);
    nodesGateway = module.get(NodesGateway);

    // Reset mock call histories before each individual test case
    jest.clearAllMocks();
  });

  // Basic sanity check to ensure the service is properly instantiated
  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ==========================================================================
  // TESTS: handleSpotifySync()
  // ==========================================================================
  describe('handleSpotifySync', () => {
    it('should successfully fetch song info from FastAPI, update node status to ACTIVE, and broadcast via WebSockets when synced is true', async () => {
      // Arrange: mock nodes list from database
      const mockNodes: any[] = [
        {
          id: 'node-1',
          userId: 'user-1',
          songTitle: '',
          artist: '',
          isPlaying: false,
        },
      ];
      (prismaService.node.findMany as any).mockResolvedValue(mockNodes);

      // Arrange: mock successful FastAPI song response with synced true
      const apiResponse = {
        data: {
          synced: true,
          song: 'Bohemian Rhapsody',
          artist: 'Queen',
          isPlaying: true,
        },
      };
      (httpService.get as any).mockReturnValue(of(apiResponse));

      const updatedNodeResult = {
        id: 'node-1',
        userId: 'user-1',
        songTitle: 'Bohemian Rhapsody',
        artist: 'Queen',
        isPlaying: true,
        status: NodeStatus.ACTIVE,
        user: { username: 'ruben' },
      };
      (prismaService.node.update as any).mockResolvedValue(updatedNodeResult);

      // Act: execute cron sync task
      await service.handleSpotifySync();

      // Assert: verify database update and WebSocket broadcast
      const expectedUrl = `${process.env.FASTAPI_URL || 'http://localhost:8000'}/nodes/user-1/song`;
      expect(prismaService.node.findMany).toHaveBeenCalled();
      expect(httpService.get).toHaveBeenCalledWith(expectedUrl, {
        timeout: 7000,
      });
      expect(prismaService.node.update).toHaveBeenCalledWith({
        where: { id: 'node-1' },
        data: {
          songTitle: 'Bohemian Rhapsody',
          artist: 'Queen',
          isPlaying: true,
          status: NodeStatus.ACTIVE,
        },
        include: {
          user: {
            select: {
              username: true,
            },
          },
        },
      });
      expect(nodesGateway.broadcastNodeUpdate).toHaveBeenCalledWith(
        'user-1',
        updatedNodeResult,
      );
    });

    it('should clear song info, set isPlaying to false, and set status to IDLE when synced is false', async () => {
      // Arrange: mock node currently playing
      const mockNodes: any[] = [
        {
          id: 'node-1',
          userId: 'user-1',
          songTitle: 'Old Song',
          artist: 'Old Artist',
          isPlaying: true,
        },
      ];
      (prismaService.node.findMany as any).mockResolvedValue(mockNodes);

      // Arrange: mock FastAPI response with synced false
      const apiResponse = {
        data: {
          synced: false,
          song: 'Unknown',
          artist: 'Unknown',
          isPlaying: false,
        },
      };
      (httpService.get as any).mockReturnValue(of(apiResponse));

      const updatedNodeResult = {
        id: 'node-1',
        userId: 'user-1',
        songTitle: '',
        artist: '',
        isPlaying: false,
        status: NodeStatus.IDLE,
        user: { username: 'ruben' },
      };
      (prismaService.node.update as any).mockResolvedValue(updatedNodeResult);

      // Act: execute sync
      await service.handleSpotifySync();

      // Assert: verify fields are cleared out and WebSocket notification is emitted
      expect(prismaService.node.update).toHaveBeenCalledWith({
        where: { id: 'node-1' },
        data: {
          songTitle: '',
          artist: '',
          isPlaying: false,
          status: NodeStatus.IDLE,
        },
        include: {
          user: {
            select: {
              username: true,
            },
          },
        },
      });
      expect(nodesGateway.broadcastNodeUpdate).toHaveBeenCalledWith(
        'user-1',
        updatedNodeResult,
      );
    });

    it('should catch individual node sync failures and continue processing other nodes', async () => {
      // Arrange: mock multiple nodes where the first fails and the second succeeds
      const mockNodes: any[] = [
        {
          id: 'node-1',
          userId: 'user-1',
          songTitle: '',
          artist: '',
          isPlaying: false,
        },
        {
          id: 'node-2',
          userId: 'user-2',
          songTitle: '',
          artist: '',
          isPlaying: false,
        },
      ];
      (prismaService.node.findMany as any).mockResolvedValue(mockNodes);

      // First node request fails with network error
      (httpService.get as any).mockReturnValueOnce(
        throwError(() => new Error('FastAPI connection error')),
      );

      // Second node request succeeds
      const successResponse = {
        data: {
          synced: true,
          song: 'Hit The Road Jack',
          artist: 'Ray Charles',
          isPlaying: true,
        },
      };
      (httpService.get as any).mockReturnValueOnce(of(successResponse));

      const updatedNodeResult = {
        id: 'node-2',
        userId: 'user-2',
        songTitle: 'Hit The Road Jack',
        artist: 'Ray Charles',
        isPlaying: true,
        status: NodeStatus.ACTIVE,
        user: { username: 'jorge' },
      };
      (prismaService.node.update as any).mockResolvedValue(updatedNodeResult);

      // Act & Assert: should not throw error globally
      await expect(service.handleSpotifySync()).resolves.toBeUndefined();

      // Verify second node was updated despite first node failure
      expect(prismaService.node.update).toHaveBeenCalledTimes(1);
      expect(nodesGateway.broadcastNodeUpdate).toHaveBeenCalledTimes(1);
      expect(nodesGateway.broadcastNodeUpdate).toHaveBeenCalledWith(
        'user-2',
        updatedNodeResult,
      );
    });

    it('should catch global errors if fetching nodes list fails completely', async () => {
      // Arrange: mock prisma findMany to throw an error
      (prismaService.node.findMany as any).mockRejectedValue(
        new Error('Database connection error'),
      );

      // Act & Assert: should handle error gracefully without throwing
      await expect(service.handleSpotifySync()).resolves.toBeUndefined();
      expect(httpService.get).not.toHaveBeenCalled();
    });
  });
});
