import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { LobbiesController } from './lobbies.controller';
import { LobbiesService } from './lobbies.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// ============================================================================
// TEST SUITE: LobbiesController
// ============================================================================
describe('LobbiesController', () => {
  let controller: LobbiesController;
  let service: jest.Mocked<LobbiesService>;

  // ==========================================================================
  // SETUP & INITIALIZATION
  // ==========================================================================
  beforeEach(async () => {
    // Define mock implementations for LobbiesService methods
    const mockService = {
      getUserLobby: jest.fn(),
      switchLobbyToFriend: jest.fn(),
    };

    // Compile testing module bypassing JwtAuthGuard
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LobbiesController],
      providers: [
        {
          provide: LobbiesService,
          useValue: mockService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<LobbiesController>(LobbiesController);
    service = module.get(LobbiesService);

    // Reset mock call histories before each test case
    jest.clearAllMocks();
  });

  // Basic sanity check to ensure controller instantiation
  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ==========================================================================
  // TESTS: getMyLobby()
  // ==========================================================================
  describe('getMyLobby', () => {
    it('should extract user ID and retrieve current user lobby details', async () => {
      // Arrange: mock request containing user claims and expected lobby response
      const mockReq = { user: { id: 'user-1' } } as any;
      const mockLobby = { id: 'lobby-1', name: 'Test Lobby v1.0.0' };
      service.getUserLobby.mockResolvedValue(mockLobby as any);

      // Act: invoke endpoint
      const result = await controller.getMyLobby(mockReq);

      // Assert: verify service call parameters and response
      expect(service.getUserLobby).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockLobby);
    });
  });

  // ==========================================================================
  // TESTS: joinFriendLobby()
  // ==========================================================================
  describe('joinFriendLobby', () => {
    it('should extract user ID and delegate switch request to LobbiesService', async () => {
      // Arrange: mock request payload and target friend DTO
      const mockReq = { user: { id: 'user-1' } } as any;
      const dto = { friendId: 'friend-uuid-123' };
      const mockLobby = { id: 'lobby-friend', name: 'Friend Lobby v1.0.0' };
      service.switchLobbyToFriend.mockResolvedValue(mockLobby as any);

      // Act: invoke endpoint
      const result = await controller.joinFriendLobby(mockReq, dto);

      // Assert: verify service parameters and returned switched lobby
      expect(service.switchLobbyToFriend).toHaveBeenCalledWith(
        'user-1',
        'friend-uuid-123',
      );
      expect(result).toEqual(mockLobby);
    });
  });
});
