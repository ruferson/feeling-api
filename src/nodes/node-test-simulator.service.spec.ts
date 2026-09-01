import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { NodeTestSimulatorService } from './node-test-simulator.service';
import { PrismaService } from '../prisma/prisma.service';
import { NodesGateway } from './nodes.gateway';

// ============================================================================
// TEST SUITE: NodeTestSimulatorService
// ============================================================================
describe('NodeTestSimulatorService', () => {
  let service: NodeTestSimulatorService;
  let prismaService: jest.Mocked<PrismaService>;
  let nodesGateway: jest.Mocked<NodesGateway>;

  // ==========================================================================
  // SETUP & INITIALIZATION
  // ==========================================================================
  beforeEach(async () => {
    // Define mock implementations for Prisma and Gateway dependencies
    const mockPrismaService = {
      node: {
        update: jest.fn(),
      },
    };

    const mockNodesGateway = {
      server: {
        emit: jest.fn(),
      },
    };

    // Compile the NestJS testing module
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NodeTestSimulatorService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: NodesGateway,
          useValue: mockNodesGateway,
        },
      ],
    }).compile();

    service = module.get<NodeTestSimulatorService>(NodeTestSimulatorService);
    prismaService = module.get(PrismaService);
    nodesGateway = module.get(NodesGateway);

    // Reset mock call histories before each individual test case
    jest.clearAllMocks();
  });

  // Basic sanity check to ensure the service is properly instantiated
  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ==========================================================================
  // TESTS: Lifecycle Hooks (onModuleInit & onModuleDestroy)
  // ==========================================================================
  describe('lifecycle hooks', () => {
    it('onModuleInit should execute without throwing errors (intentionally disabled)', () => {
      // Act & Assert: ensure module init executes cleanly
      expect(() => service.onModuleInit()).not.toThrow();
    });

    it('onModuleDestroy should stop simulation safely', () => {
      // Arrange: start simulation first to assign a timer
      service.startSimulation();

      // Act & Assert: ensure destruction stops the timer without throwing
      expect(() => service.onModuleDestroy()).not.toThrow();
    });
  });

  // ==========================================================================
  // TESTS: Simulation Controls (startSimulation & stopSimulation)
  // ==========================================================================
  describe('simulation controls', () => {
    it('startSimulation and stopSimulation should manage timer state correctly', () => {
      // Act: start simulation
      service.startSimulation();

      // Act & Assert: stopping active simulation should clear timer safely
      expect(() => service.stopSimulation()).not.toThrow();

      // Calling stop simulation a second time should also be safe (idempotent)
      expect(() => service.stopSimulation()).not.toThrow();
    });
  });
});
