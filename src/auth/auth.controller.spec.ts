import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

// ============================================================================
// TEST SUITE: AuthController
// ============================================================================
describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  // Standard mock authentication response object used across test cases
  const mockAuthResult = {
    user: {
      id: 'user-uuid-123',
      username: 'ruben',
      email: 'ruben@example.com',
      node: { id: 'node-uuid-123', posX: 0, posY: 0 },
    },
    accessToken: 'jwt_token_abc',
  };

  // ==========================================================================
  // SETUP & INITIALIZATION
  // ==========================================================================
  beforeEach(async () => {
    // Define mock implementation for AuthService methods
    const mockAuthService = {
      register: jest.fn(),
      login: jest.fn(),
      getSpotifyLoginUrl: jest.fn(),
      linkSpotifyAccount: jest.fn(),
    };

    // Compile the NestJS testing module, bypassing guards for clean controller isolation
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);

    // Reset mock call histories before each individual test case
    jest.clearAllMocks();
  });

  // Basic sanity check to ensure the controller is properly instantiated
  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ==========================================================================
  // TESTS: register()
  // ==========================================================================
  describe('register', () => {
    it('should delegate registration to AuthService and return user data with token', async () => {
      // Arrange: prepare DTO payload and expected mock service resolution
      const registerDto = {
        username: 'ruben',
        email: 'ruben@example.com',
        password: 'plain_password',
        posX: 0,
        posY: 0,
      };
      authService.register.mockResolvedValue(mockAuthResult as any);

      // Act: invoke controller register method
      const result = await controller.register(registerDto);

      // Assert: verify service interaction and returned response
      expect(authService.register).toHaveBeenCalledWith(registerDto);
      expect(result).toEqual(mockAuthResult);
    });
  });

  // ==========================================================================
  // TESTS: login()
  // ==========================================================================
  describe('login', () => {
    it('should delegate authentication to AuthService and return access token', async () => {
      // Arrange: prepare login credentials DTO and service mock response
      const loginDto = {
        username: 'ruben',
        password: 'plain_password',
      };
      authService.login.mockResolvedValue(mockAuthResult as any);

      // Act: invoke controller login method
      const result = await controller.login(loginDto);

      // Assert: verify service interaction and returned token
      expect(authService.login).toHaveBeenCalledWith(loginDto);
      expect(result).toEqual(mockAuthResult);
    });
  });

  // ==========================================================================
  // TESTS: getSpotifyLoginUrl()
  // ==========================================================================
  describe('getSpotifyLoginUrl', () => {
    it('should retrieve Spotify authorization URL from AuthService', async () => {
      // Arrange: prepare expected login URL structure
      const mockResponse = {
        authUrl: 'https://accounts.spotify.com/authorize?client_id=123',
      };
      authService.getSpotifyLoginUrl.mockResolvedValue(mockResponse as any);

      // Act: invoke controller getSpotifyLoginUrl method
      const result = await controller.getSpotifyLoginUrl();

      // Assert: verify service interaction and returned URL object
      expect(authService.getSpotifyLoginUrl).toHaveBeenCalled();
      expect(result).toEqual(mockResponse);
    });
  });

  // ==========================================================================
  // TESTS: getProfile()
  // ==========================================================================
  describe('getProfile', () => {
    it('should return authenticated user payload from request object', () => {
      // Arrange: mock incoming request object containing user data attached by guard/strategy
      const mockReq = {
        user: mockAuthResult.user,
      };

      // Act: invoke controller getProfile method
      const result = controller.getProfile(mockReq);

      // Assert: verify extracted user data matches request user
      expect(result).toEqual(mockAuthResult.user);
    });
  });

  // ==========================================================================
  // TESTS: linkSpotify()
  // ==========================================================================
  describe('linkSpotify', () => {
    it('should pass authenticated user ID and OAuth code to AuthService', async () => {
      // Arrange: setup request object with user ID and Spotify auth DTO
      const mockReq = {
        user: { id: 'user-uuid-123' },
      };
      const spotifyAuthDto = { code: 'spotify_auth_code_xyz' };
      const linkedAccountResponse = {
        spotifyAccountId: 'acc_123',
        spotifyDisplayName: 'Ruben',
      };

      authService.linkSpotifyAccount.mockResolvedValue(
        linkedAccountResponse as any,
      );

      // Act: invoke controller linkSpotify method
      const result = await controller.linkSpotify(mockReq, spotifyAuthDto);

      // Assert: verify correct parameters passed to service layer
      expect(authService.linkSpotifyAccount).toHaveBeenCalledWith(
        'user-uuid-123',
        'spotify_auth_code_xyz',
      );
      expect(result).toEqual(linkedAccountResponse);
    });
  });
});
