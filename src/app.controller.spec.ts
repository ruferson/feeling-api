import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// ============================================================================
// TEST SUITE: AppController
// ============================================================================
describe('AppController', () => {
  let controller: AppController;
  let appService: jest.Mocked<AppService>;

  // ==========================================================================
  // SETUP & INITIALIZATION
  // ==========================================================================
  beforeEach(async () => {
    // Define mock implementation for AppService health check method
    const mockAppService = {
      getHealthCheck: jest.fn(),
    };

    // Compile the NestJS testing module with the mocked service provider
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: mockAppService,
        },
      ],
    }).compile();

    controller = module.get<AppController>(AppController);
    appService = module.get(AppService);

    // Reset mock call histories before each individual test case
    jest.clearAllMocks();
  });

  // Basic sanity check to ensure the controller is properly instantiated
  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ==========================================================================
  // TESTS: getHealthCheck()
  // ==========================================================================
  describe('getHealthCheck', () => {
    it('should return health check status object from AppService', () => {
      // Arrange: mock health status payload returned by the service
      const healthData = {
        status: 'ok',
        service: 'FeelinG Backend API',
        timestamp: '2026-09-01T12:00:00.000Z',
        uptime: 120.5,
      };
      appService.getHealthCheck.mockReturnValue(healthData);

      // Act: invoke controller health check endpoint
      const result = controller.getHealthCheck();

      // Assert: verify service interaction and returned status structure
      expect(appService.getHealthCheck).toHaveBeenCalled();
      expect(result).toEqual(healthData);
    });
  });
});
