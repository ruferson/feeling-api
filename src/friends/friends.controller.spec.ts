import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// ============================================================================
// TEST SUITE: FriendsController
// ============================================================================
describe('FriendsController', () => {
  let controller: FriendsController;
  let friendsService: jest.Mocked<FriendsService>;

  // ==========================================================================
  // SETUP & INITIALIZATION
  // ==========================================================================
  beforeEach(async () => {
    // Define mock implementations for FriendsService methods
    const mockFriendsService = {
      sendRequest: jest.fn(),
      acceptRequest: jest.fn(),
      rejectRequest: jest.fn(),
      removeOrReject: jest.fn(),
      getFriends: jest.fn(),
      getSentRequests: jest.fn(),
      getPendingRequests: jest.fn(),
    };

    // Compile the NestJS testing module, bypassing JwtAuthGuard for clean isolated testing
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FriendsController],
      providers: [
        {
          provide: FriendsService,
          useValue: mockFriendsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<FriendsController>(FriendsController);
    friendsService = module.get(FriendsService);

    // Reset mock call histories before each individual test case
    jest.clearAllMocks();
  });

  // Basic sanity check to ensure the controller is properly instantiated
  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ==========================================================================
  // TESTS: sendRequest()
  // ==========================================================================
  describe('sendRequest', () => {
    it('should extract sender ID (supporting both id and sub claims) and delegate to FriendsService', async () => {
      // Arrange: mock request with user property and DTO body
      const mockReq = { user: { id: 'user-uuid-123' } } as any;
      const dto = { username: 'amigo' };
      const expectedResponse = { id: 'f-1', status: 'PENDING' };
      friendsService.sendRequest.mockResolvedValue(expectedResponse as any);

      // Act: invoke controller endpoint
      const result = await controller.sendRequest(mockReq, dto);

      // Assert: verify parameter extraction and service call
      expect(friendsService.sendRequest).toHaveBeenCalledWith(
        'user-uuid-123',
        'amigo',
      );
      expect(result).toEqual(expectedResponse);
    });

    it('should fallback to sub property if id is missing in request user object', async () => {
      // Arrange: mock request using sub claim instead of id
      const mockReq = { user: { sub: 'user-sub-456' } } as any;
      const dto = { username: 'amigo' };
      friendsService.sendRequest.mockResolvedValue({} as any);

      // Act: invoke controller endpoint
      await controller.sendRequest(mockReq, dto);

      // Assert: verify fallback extraction to sub
      expect(friendsService.sendRequest).toHaveBeenCalledWith(
        'user-sub-456',
        'amigo',
      );
    });
  });

  // ==========================================================================
  // TESTS: acceptRequest()
  // ==========================================================================
  describe('acceptRequest', () => {
    it('should extract user ID and delegate request acceptance to FriendsService', async () => {
      // Arrange: mock request user and route param friendship id
      const mockReq = { user: { id: 'user-uuid-123' } } as any;
      const friendshipId = 'f-1';
      const expectedResponse = { id: 'f-1', status: 'ACCEPTED' };
      friendsService.acceptRequest.mockResolvedValue(expectedResponse as any);

      // Act: invoke accept endpoint
      const result = await controller.acceptRequest(mockReq, friendshipId);

      // Assert: verify correct service mapping
      expect(friendsService.acceptRequest).toHaveBeenCalledWith(
        'user-uuid-123',
        'f-1',
      );
      expect(result).toEqual(expectedResponse);
    });
  });

  // ==========================================================================
  // TESTS: rejectRequest()
  // ==========================================================================
  describe('rejectRequest', () => {
    it('should extract user ID and delegate request rejection to FriendsService', async () => {
      // Arrange: mock request user and friendship id parameter
      const mockReq = { user: { id: 'user-uuid-123' } } as any;
      const friendshipId = 'f-1';
      const expectedResponse = { id: 'f-1' };
      friendsService.rejectRequest.mockResolvedValue(expectedResponse as any);

      // Act: invoke reject endpoint
      const result = await controller.rejectRequest(mockReq, friendshipId);

      // Assert: verify service call parameters
      expect(friendsService.rejectRequest).toHaveBeenCalledWith(
        'user-uuid-123',
        'f-1',
      );
      expect(result).toEqual(expectedResponse);
    });
  });

  // ==========================================================================
  // TESTS: removeOrReject()
  // ==========================================================================
  describe('removeOrReject', () => {
    it('should extract user ID and delegate relationship removal to FriendsService', async () => {
      // Arrange: mock request user and friendship id parameter
      const mockReq = { user: { id: 'user-uuid-123' } } as any;
      const friendshipId = 'f-1';
      const expectedResponse = { id: 'f-1' };
      friendsService.removeOrReject.mockResolvedValue(expectedResponse as any);

      // Act: invoke delete endpoint
      const result = await controller.removeOrReject(mockReq, friendshipId);

      // Assert: verify service call parameters
      expect(friendsService.removeOrReject).toHaveBeenCalledWith(
        'user-uuid-123',
        'f-1',
      );
      expect(result).toEqual(expectedResponse);
    });
  });

  // ==========================================================================
  // TESTS: getFriends()
  // ==========================================================================
  describe('getFriends', () => {
    it('should retrieve active friends list and pass pagination DTO to FriendsService', async () => {
      // Arrange: mock request user, query dto and service response
      const mockReq = { user: { id: 'user-uuid-123' } } as any;
      const queryDto = { page: 1, limit: 10 };
      const expectedFriends = [{ friendshipId: 'f-1', username: 'friend1' }];
      friendsService.getFriends.mockResolvedValue(expectedFriends as any);

      // Act: invoke get friends endpoint
      const result = await controller.getFriends(mockReq, queryDto);

      // Assert: verify service interaction with query dto
      expect(friendsService.getFriends).toHaveBeenCalledWith(
        'user-uuid-123',
        queryDto,
      );
      expect(result).toEqual(expectedFriends);
    });
  });

  // ==========================================================================
  // TESTS: getSentRequests() & getPendingRequests()
  // ==========================================================================
  describe('getSentRequests', () => {
    it('should retrieve sent pending requests and pass pagination DTO to FriendsService', async () => {
      // Arrange: mock request user, query dto and service response
      const mockReq = { user: { id: 'user-uuid-123' } } as any;
      const queryDto = { page: 1, limit: 10 };
      const expectedRequests = [{ id: 'f-1', status: 'PENDING' }];
      friendsService.getSentRequests.mockResolvedValue(expectedRequests as any);

      // Act: invoke get sent requests endpoint
      const result = await controller.getSentRequests(mockReq, queryDto);

      // Assert: verify service interaction
      expect(friendsService.getSentRequests).toHaveBeenCalledWith(
        'user-uuid-123',
        queryDto,
      );
      expect(result).toEqual(expectedRequests);
    });
  });

  describe('getPendingRequests', () => {
    it('should retrieve incoming pending requests and pass pagination DTO to FriendsService', async () => {
      // Arrange: mock request user, query dto and service response
      const mockReq = { user: { id: 'user-uuid-123' } } as any;
      const queryDto = { page: 1, limit: 10 };
      const expectedRequests = [{ id: 'f-2', status: 'PENDING' }];
      friendsService.getPendingRequests.mockResolvedValue(
        expectedRequests as any,
      );

      // Act: invoke get pending requests endpoint
      const result = await controller.getPendingRequests(mockReq, queryDto);

      // Assert: verify service interaction
      expect(friendsService.getPendingRequests).toHaveBeenCalledWith(
        'user-uuid-123',
        queryDto,
      );
      expect(result).toEqual(expectedRequests);
    });
  });
});
