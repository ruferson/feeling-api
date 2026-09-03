import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { NodesService } from './nodes.service';
import { PrismaService } from '../prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { LobbiesService } from '../lobbies/lobbies.service';
import { NotFoundException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { NodeStatus } from '@prisma/client';

// ============================================================================
// TEST SUITE: NodesService
// ============================================================================
describe('NodesService', () => {
  let service: NodesService;
  let prismaService: jest.Mocked<PrismaService>;
  let httpService: jest.Mocked<HttpService>;
  let lobbiesService: jest.Mocked<LobbiesService>;

  // ==========================================================================
  // SETUP & INITIALIZATION
  // ==========================================================================
  beforeEach(async () => {
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

    const mockLobbiesService = {
      getOrCreateAvailableLobbyForUser: jest.fn(),
      getUserLobby: jest.fn(),
      switchLobbyToFriend: jest.fn(),
    };

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
        {
          provide: LobbiesService,
          useValue: mockLobbiesService,
        },
      ],
    }).compile();

    service = module.get<NodesService>(NodesService);
    prismaService = module.get(PrismaService);
    httpService = module.get(HttpService);
    lobbiesService = module.get(LobbiesService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ==========================================================================
  // TESTS: findAll()
  // ==========================================================================
  describe('findAll', () => {
    const requestingUserId = 'user-1';
    const lobbyId = 'lobby-uuid-123';

    it('should return nodes in the same lobby with visible Spotify details for owner/friends and masked details for strangers', async () => {
      (prismaService.node.findUnique as any).mockResolvedValue({
        lobbyId,
      });

      const friendships: any[] = [
        {
          id: 'f-1',
          senderId: requestingUserId,
          receiverId: 'user-2',
          status: 'ACCEPTED',
        },
      ];
      (prismaService.friendship.findMany as any).mockResolvedValue(friendships);

      const nodes: any[] = [
        {
          userId: 'user-1',
          posX: 10,
          posY: 20,
          lobbyId,
          bpm: 120,
          bpmEstimated: false,
          isPlaying: true,
          songTitle: 'Song A',
          artist: 'Artist A',
          status: NodeStatus.ACTIVE,
          user: { id: 'user-1', username: 'ruben' },
        },
        {
          userId: 'user-2',
          posX: 15,
          posY: 25,
          lobbyId,
          bpm: 130,
          bpmEstimated: true,
          isPlaying: false,
          songTitle: 'Song B',
          artist: 'Artist B',
          status: NodeStatus.ACTIVE,
          user: { id: 'user-2', username: 'friend' },
        },
        {
          userId: 'user-3',
          posX: 30,
          posY: 40,
          lobbyId,
          bpm: 140,
          bpmEstimated: false,
          isPlaying: true,
          songTitle: 'Song C',
          artist: 'Artist C',
          status: NodeStatus.ACTIVE,
          user: { id: 'user-3', username: 'stranger' },
        },
      ];
      (prismaService.node.findMany as any).mockResolvedValue(nodes);

      const result = await service.findAll(requestingUserId);

      expect(result).toEqual([
        {
          id: 'user-1',
          label: 'ruben',
          posX: 10,
          posY: 20,
          status: 'ACTIVE',
          lobbyId,
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
          lobbyId,
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
          lobbyId,
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
      const existingNode = { userId, posX: 10, posY: 10, bpm: 100 };
      const updatedNode = { userId, posX: 50.5, posY: 60.6, bpm: 125 };
      (prismaService.node.findUnique as any).mockResolvedValue(existingNode);
      (prismaService.node.update as any).mockResolvedValue(updatedNode);

      const result = await service.updateLocation(userId, updateDto);

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
      (prismaService.node.findUnique as any).mockResolvedValue(null);

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
      const apiResponse = {
        data: { song: 'Shape of You', artist: 'Ed Sheeran', synced: true },
      };
      (httpService.get as jest.Mock).mockReturnValue(of(apiResponse));

      const result = await service.getSongInfoFromFastApi(nodeId);

      expect(httpService.get).toHaveBeenCalledWith(
        `http://localhost:8000/nodes/${nodeId}/song`,
      );
      expect(result).toEqual(apiResponse.data);
    });

    it('should fallback to default unknown song object if FastAPI request fails', async () => {
      (httpService.get as jest.Mock).mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      const result = await service.getSongInfoFromFastApi(nodeId);

      expect(result).toEqual({
        song: 'Unknown',
        artist: 'Unknown',
        synced: false,
      });
    });
  });
});
