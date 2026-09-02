import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

// ============================================================================
// TEST SUITE: UsersService
// ============================================================================
describe('UsersService', () => {
  let service: UsersService;
  let prismaService: jest.Mocked<PrismaService>;

  // ==========================================================================
  // SETUP & INITIALIZATION
  // ==========================================================================
  beforeEach(async () => {
    // Define mock implementation for Prisma client user operations
    const mockPrismaService = {
      user: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };

    // Compile testing module with mocked Prisma service
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prismaService = module.get(PrismaService);

    // Reset mock call history before each test case
    jest.clearAllMocks();
  });

  // Basic sanity check to ensure service instantiation
  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ==========================================================================
  // TESTS: create()
  // ==========================================================================
  describe('create', () => {
    it('should create a new user along with an associated node and return the result', async () => {
      // Arrange: prepare register DTO and expected created entity
      const registerDto = {
        username: 'ruben',
        email: 'ruben@example.com',
        password: 'hashed_password_123',
        posX: 10,
        posY: 20,
      };
      const createdUser = {
        id: 'user-uuid-123',
        username: registerDto.username,
        email: registerDto.email,
        node: { id: 'node-uuid-123', posX: 10, posY: 20, status: 'IDLE' },
      };
      (prismaService.user.create as any).mockResolvedValue(createdUser);

      // Act: call create method
      const result = await service.create(registerDto as any);

      // Assert: verify prisma create query arguments and returned user
      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: {
          username: registerDto.username,
          email: registerDto.email,
          password: registerDto.password,
          node: {
            create: {
              posX: registerDto.posX,
              posY: registerDto.posY,
              status: 'IDLE',
            },
          },
        },
        include: {
          node: true,
        },
      });
      expect(result).toEqual(createdUser);
    });
  });

  // ==========================================================================
  // TESTS: findByEmail()
  // ==========================================================================
  describe('findByEmail', () => {
    it('should find and return user by email including their node', async () => {
      // Arrange: mock email search response
      const email = 'ruben@example.com';
      const mockUser = { id: 'user-1', email, node: { id: 'node-1' } };
      (prismaService.user.findUnique as any).mockResolvedValue(mockUser);

      // Act: call findByEmail
      const result = await service.findByEmail(email);

      // Assert: verify findUnique query and result
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email },
        include: { node: true },
      });
      expect(result).toEqual(mockUser);
    });
  });

  // ==========================================================================
  // TESTS: findByUsername()
  // ==========================================================================
  describe('findByUsername', () => {
    it('should find and return user by username including their node', async () => {
      // Arrange: mock username search response
      const username = 'ruben';
      const mockUser = { id: 'user-1', username, node: { id: 'node-1' } };
      (prismaService.user.findUnique as any).mockResolvedValue(mockUser);

      // Act: call findByUsername
      const result = await service.findByUsername(username);

      // Assert: verify findUnique query and result
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { username },
        include: { node: true },
      });
      expect(result).toEqual(mockUser);
    });
  });

  // ==========================================================================
  // TESTS: findBySpotifyAccountId()
  // ==========================================================================
  describe('findBySpotifyAccountId', () => {
    it('should find and return user by spotify account ID', async () => {
      // Arrange: mock Spotify ID search response
      const spotifyAccountId = 'spotify_acc_123';
      const mockUser = { id: 'user-1', spotifyAccountId };
      (prismaService.user.findUnique as any).mockResolvedValue(mockUser);

      // Act: call findBySpotifyAccountId
      const result = await service.findBySpotifyAccountId(spotifyAccountId);

      // Assert: verify query and result
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { spotifyAccountId },
      });
      expect(result).toEqual(mockUser);
    });
  });

  // ==========================================================================
  // TESTS: findById()
  // ==========================================================================
  describe('findById', () => {
    it('should find and return selected user profile fields by ID', async () => {
      // Arrange: mock user profile response
      const userId = 'user-1';
      const userProfile = {
        id: userId,
        username: 'ruben',
        email: 'ruben@example.com',
      };
      (prismaService.user.findUnique as any).mockResolvedValue(userProfile);

      // Act: call findById
      const result = await service.findById(userId);

      // Assert: verify select fields and returned profile
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: expect.any(Object),
      });
      expect(result).toEqual(userProfile);
    });
  });

  // ==========================================================================
  // TESTS: searchUsers()
  // ==========================================================================
  describe('searchUsers', () => {
    it('should return a list of users matching query excluding current user', async () => {
      // Arrange: mock search query results
      const query = 'rub';
      const currentUserId = 'user-1';
      const matchingUsers: any[] = [{ id: 'user-2', username: 'ruben' }];
      (prismaService.user.findMany as any).mockResolvedValue(matchingUsers);

      // Act: execute search
      const result = await service.searchUsers(query, currentUserId);

      // Assert: verify query filters and pagination limit (take: 10)
      expect(prismaService.user.findMany).toHaveBeenCalledWith({
        where: {
          id: { not: currentUserId },
          username: { contains: query, mode: 'insensitive' },
        },
        select: {
          id: true,
          username: true,
          node: true,
        },
        take: 10,
      });
      expect(result).toEqual(matchingUsers);
    });
  });

  // ==========================================================================
  // TESTS: connectSpotify()
  // ==========================================================================
  describe('connectSpotify', () => {
    it('should update user record with Spotify account credentials', async () => {
      // Arrange: setup variables and mock update response
      const userId = 'user-1';
      const spotifyAccountId = 'spotify_acc_123';
      const spotifyDisplayName = 'RubenSpotify';
      const updatedUser = {
        id: userId,
        username: 'ruben',
        email: 'ruben@example.com',
        spotifyAccountId,
        spotifyDisplayName,
        spotifyConnectedAt: new Date(),
      };
      (prismaService.user.update as any).mockResolvedValue(updatedUser);

      // Act: execute connectSpotify
      const result = await service.connectSpotify(
        userId,
        spotifyAccountId,
        spotifyDisplayName,
      );

      // Assert: verify prisma update query arguments
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          spotifyAccountId,
          spotifyDisplayName,
          spotifyConnectedAt: expect.any(Date),
        },
        select: {
          id: true,
          username: true,
          email: true,
          spotifyAccountId: true,
          spotifyDisplayName: true,
          spotifyConnectedAt: true,
        },
      });
      expect(result).toEqual(updatedUser);
    });
  });
});
