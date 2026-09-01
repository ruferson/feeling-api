import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { HttpService } from '@nestjs/axios';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { of } from 'rxjs';
import * as bcrypt from 'bcrypt';

// ============================================================================
// TEST SUITE: AuthService
// ============================================================================
describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let httpService: jest.Mocked<HttpService>;

  // Standard mock user entity used across multiple test scenarios
  const mockUser = {
    id: 'user-uuid-123',
    username: 'ruben',
    email: 'ruben@example.com',
    password: '', // Dynamically populated with a real bcrypt hash in beforeEach
    node: { id: 'node-uuid-123', posX: 0, posY: 0 },
    spotifyAccountId: null,
    spotifyDisplayName: null,
  };

  let mockUsersService: any;
  let mockJwtService: any;
  let mockHttpService: any;

  // ==========================================================================
  // SETUP & INITIALIZATION
  // ==========================================================================
  beforeEach(async () => {
    // Generate a real bcrypt password hash to ensure native verification works in login tests
    const realHashedPassword = await bcrypt.hash('plain_password', 10);
    mockUser.password = realHashedPassword;

    // Define mock implementations for dependent services
    mockUsersService = {
      findByEmail: jest.fn(),
      findByUsername: jest.fn(),
      findBySpotifyAccountId: jest.fn(),
      create: jest.fn(),
      connectSpotify: jest.fn(),
    };

    mockJwtService = {
      sign: jest.fn(),
    };

    mockHttpService = {
      get: jest.fn(),
      post: jest.fn(),
      delete: jest.fn(),
    };

    // Compile the NestJS testing module with provided mocks
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: HttpService, useValue: mockHttpService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    httpService = module.get(HttpService);

    // Reset mock call histories before each individual test case
    jest.clearAllMocks();
  });

  // Basic sanity check to ensure the service is properly instantiated
  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ==========================================================================
  // TESTS: register()
  // ==========================================================================
  describe('register', () => {
    const registerDto = {
      username: 'ruben',
      email: 'ruben@example.com',
      password: 'plain_password',
      posX: 0,
      posY: 0,
    };

    it('should successfully register a new user and return user data with token', async () => {
      // Arrange: simulate non-existing user and successful creation
      usersService.findByEmail.mockResolvedValue(null);
      usersService.findByUsername.mockResolvedValue(null);
      usersService.create.mockResolvedValue({
        ...mockUser,
        username: registerDto.username,
        email: registerDto.email,
      } as any);
      jwtService.sign.mockReturnValue('jwt_token_abc');

      // Act: call register method
      const result = await service.register(registerDto);

      // Assert: verify calls and returned payload structure
      expect(usersService.findByEmail).toHaveBeenCalledWith(registerDto.email);
      expect(usersService.findByUsername).toHaveBeenCalledWith(
        registerDto.username,
      );
      expect(usersService.create).toHaveBeenCalled();
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        username: registerDto.username,
      });

      expect(result).toEqual({
        user: {
          id: mockUser.id,
          username: registerDto.username,
          email: registerDto.email,
          node: mockUser.node,
        },
        accessToken: 'jwt_token_abc',
      });
    });

    it('should throw ConflictException if email is already taken', async () => {
      // Arrange: simulate email collision
      usersService.findByEmail.mockResolvedValue(mockUser as any);

      // Act & Assert: expect conflict exception and early exit
      await expect(service.register(registerDto)).rejects.toThrow(
        new ConflictException('Email address is already registered'),
      );
      expect(usersService.findByUsername).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if username is already taken', async () => {
      // Arrange: simulate username collision
      usersService.findByEmail.mockResolvedValue(null);
      usersService.findByUsername.mockResolvedValue(mockUser as any);

      // Act & Assert: expect conflict exception before creation step
      await expect(service.register(registerDto)).rejects.toThrow(
        new ConflictException('Username is already taken'),
      );
      expect(usersService.create).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // TESTS: login()
  // ==========================================================================
  describe('login', () => {
    const loginDto = {
      username: 'ruben',
      password: 'plain_password',
    };

    it('should successfully authenticate user and return access token', async () => {
      // Arrange: match existing user and valid password hash
      usersService.findByUsername.mockResolvedValue(mockUser as any);
      jwtService.sign.mockReturnValue('jwt_token_abc');

      // Act: execute login
      const result = await service.login(loginDto);

      // Assert: verify authentication flow and token issuance
      expect(usersService.findByUsername).toHaveBeenCalledWith(
        loginDto.username,
      );
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        username: mockUser.username,
      });
      expect(result).toEqual({
        user: {
          id: mockUser.id,
          username: mockUser.username,
          email: mockUser.email,
          node: mockUser.node,
        },
        accessToken: 'jwt_token_abc',
      });
    });

    it('should throw UnauthorizedException if username is not found', async () => {
      // Arrange: return null for user search
      usersService.findByUsername.mockResolvedValue(null);

      // Act & Assert: verify unauthorized error response
      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      // Arrange: return user but supply incorrect password
      usersService.findByUsername.mockResolvedValue(mockUser as any);
      const invalidLoginDto = { username: 'ruben', password: 'wrong_password' };

      // Act & Assert: expect unauthorized exception due to password mismatch
      await expect(service.login(invalidLoginDto)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );
    });
  });

  // ==========================================================================
  // TESTS: linkSpotifyAccount()
  // ==========================================================================
  describe('linkSpotifyAccount', () => {
    const userId = 'user-uuid-123';
    const code = 'spotify_oauth_code';
    const spotifyAccountData = {
      spotifyAccountId: 'spotify_acc_123',
      spotifyDisplayName: 'RubenSpotify',
    };

    it('should successfully link spotify account when valid and not duplicated', async () => {
      // Arrange: mock successful external FastAPI response and clean linkage check
      httpService.post.mockReturnValue(of({ data: spotifyAccountData } as any));
      usersService.findBySpotifyAccountId.mockResolvedValue(null);
      usersService.connectSpotify.mockResolvedValue({
        ...mockUser,
        ...spotifyAccountData,
      } as any);

      // Act: link account
      const result = await service.linkSpotifyAccount(userId, code);

      // Assert: verify integration calls across microservices
      expect(httpService.post).toHaveBeenCalledWith(
        `http://localhost:8000/auth/spotify/${userId}`,
        { code },
      );
      expect(usersService.findBySpotifyAccountId).toHaveBeenCalledWith(
        spotifyAccountData.spotifyAccountId,
      );
      expect(usersService.connectSpotify).toHaveBeenCalledWith(
        userId,
        spotifyAccountData.spotifyAccountId,
        spotifyAccountData.spotifyDisplayName,
      );
      expect(result).toBeDefined();
    });

    it('should throw ConflictException and rollback in FastAPI if Spotify account belongs to another user', async () => {
      // Arrange: simulate account already linked to a different user ID
      const otherUser = { ...mockUser, id: 'different-user-uuid' };
      httpService.post.mockReturnValue(of({ data: spotifyAccountData } as any));
      httpService.delete.mockReturnValue(of({ data: {} } as any));
      usersService.findBySpotifyAccountId.mockResolvedValue(otherUser as any);

      // Act & Assert: expect conflict and verify DELETE rollback call to FastAPI
      await expect(service.linkSpotifyAccount(userId, code)).rejects.toThrow(
        new ConflictException(
          'Esta cuenta de Spotify ya está sincronizada con una cuenta de FeelinG',
        ),
      );

      expect(httpService.delete).toHaveBeenCalledWith(
        `http://localhost:8000/auth/spotify/${userId}`,
      );
      expect(usersService.connectSpotify).not.toHaveBeenCalled();
    });

    it('should rollback in FastAPI and rethrow error if connectSpotify fails', async () => {
      // Arrange: simulate database connection error during connection step
      httpService.post.mockReturnValue(of({ data: spotifyAccountData } as any));
      httpService.delete.mockReturnValue(of({ data: {} } as any));
      usersService.findBySpotifyAccountId.mockResolvedValue(null);
      usersService.connectSpotify.mockRejectedValue(
        new Error('Database connection error'),
      );

      // Act & Assert: expect error propagation and cleanup request
      await expect(service.linkSpotifyAccount(userId, code)).rejects.toThrow(
        'Database connection error',
      );

      expect(httpService.delete).toHaveBeenCalledWith(
        `http://localhost:8000/auth/spotify/${userId}`,
      );
    });
  });

  // ==========================================================================
  // TESTS: getSpotifyLoginUrl()
  // ==========================================================================
  describe('getSpotifyLoginUrl', () => {
    it('should fetch and return spotify login URL from FastAPI', async () => {
      // Arrange: mock response containing authentication redirect URL
      const mockResponse = {
        authUrl: 'https://accounts.spotify.com/authorize?client_id=123',
      };
      httpService.get.mockReturnValue(of({ data: mockResponse } as any));

      // Act: fetch login URL
      const result = await service.getSpotifyLoginUrl();

      // Assert: verify correct endpoint query and returned data
      expect(httpService.get).toHaveBeenCalledWith(
        'http://localhost:8000/auth/spotify/login-url',
      );
      expect(result).toEqual(mockResponse);
    });
  });
});
