import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { NodesController } from './nodes.controller';
import { NodesService } from './nodes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// ============================================================================
// TEST SUITE: NodesController
// ============================================================================
describe('NodesController', () => {
  let controller: NodesController;
  let nodesService: jest.Mocked<NodesService>;

  // ==========================================================================
  // SETUP & INITIALIZATION
  // ==========================================================================
  beforeEach(async () => {
    // Define mock implementations for NodesService methods
    const mockNodesService = {
      findAll: jest.fn(),
      updateLocation: jest.fn(),
      getSongInfoFromFastApi: jest.fn(),
    };

    // Compile the NestJS testing module, bypassing JwtAuthGuard for isolated endpoint testing
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NodesController],
      providers: [
        {
          provide: NodesService,
          useValue: mockNodesService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<NodesController>(NodesController);
    nodesService = module.get(NodesService);

    // Reset mock call histories before each individual test case
    jest.clearAllMocks();
  });

  // Basic sanity check to ensure the controller is properly instantiated
  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ==========================================================================
  // TESTS: findAll()
  // ==========================================================================
  describe('findAll', () => {
    it('should extract user ID from request and delegate to NodesService.findAll', async () => {
      // Arrange: mock request containing user id claim
      const mockReq = { user: { id: 'user-uuid-123' } } as any;
      const expectedNodes = [{ id: 'user-1', label: 'ruben' }];
      nodesService.findAll.mockResolvedValue(expectedNodes as any);

      // Act: invoke endpoint
      const result = await controller.findAll(mockReq);

      // Assert: verify service call parameters and result
      expect(nodesService.findAll).toHaveBeenCalledWith('user-uuid-123');
      expect(result).toEqual(expectedNodes);
    });

    it('should fallback to sub claim if id is missing in request user object', async () => {
      // Arrange: mock request using sub claim instead of id
      const mockReq = { user: { sub: 'user-sub-456' } } as any;
      nodesService.findAll.mockResolvedValue([] as any);

      // Act: invoke endpoint
      await controller.findAll(mockReq);

      // Assert: verify fallback extraction to sub
      expect(nodesService.findAll).toHaveBeenCalledWith('user-sub-456');
    });
  });

  // ==========================================================================
  // TESTS: updateLocation()
  // ==========================================================================
  describe('updateLocation', () => {
    it('should extract user ID and update location via NodesService', async () => {
      // Arrange: mock request user and update DTO body
      const mockReq = { user: { id: 'user-uuid-123' } } as any;
      const updateDto = { posX: 10.5, posY: 20.2 };
      const updatedNode = { userId: 'user-uuid-123', posX: 10.5, posY: 20.2 };
      nodesService.updateLocation.mockResolvedValue(updatedNode as any);

      // Act: invoke endpoint
      const result = await controller.updateLocation(mockReq, updateDto);

      // Assert: verify parameters passed to service layer
      expect(nodesService.updateLocation).toHaveBeenCalledWith(
        'user-uuid-123',
        updateDto,
      );
      expect(result).toEqual(updatedNode);
    });
  });

  // ==========================================================================
  // TESTS: getSongInfo()
  // ==========================================================================
  describe('getSongInfo', () => {
    it('should retrieve song info for a given node ID from NodesService', async () => {
      // Arrange: mock node ID parameter and service response
      const nodeId = 'node-xyz';
      const songInfo = {
        song: 'Bohemian Rhapsody',
        artist: 'Queen',
        synced: true,
      };
      nodesService.getSongInfoFromFastApi.mockResolvedValue(songInfo as any);

      // Act: invoke endpoint
      const result = await controller.getSongInfo(nodeId);

      // Assert: verify service parameter and returned data
      expect(nodesService.getSongInfoFromFastApi).toHaveBeenCalledWith(nodeId);
      expect(result).toEqual(songInfo);
    });
  });
});
