import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// ============================================================================
// E2E TEST SUITE: LobbiesController & Spatial Partitioning Workflow
// ============================================================================
describe('LobbiesController (E2E)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  let userAToken: string;
  let userBToken: string;
  let userAId: string;
  let userBId: string;

  const timestamp = Date.now();
  const userAData = {
    username: `e2e_lobby_a_${timestamp}`,
    email: `lobby_a_${timestamp}@example.com`,
    password: 'SecurePassword123!',
    posX: 0,
    posY: 0,
  };

  const userBData = {
    username: `e2e_lobby_b_${timestamp}`,
    email: `lobby_b_${timestamp}@example.com`,
    password: 'SecurePassword123!',
    posX: 10,
    posY: 10,
  };

  // ==========================================================================
  // GLOBAL TEST SETUP: Initialize application instance and seed base test accounts
  // ==========================================================================
  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    prismaService = app.get(PrismaService);

    // Register User A via HTTP endpoint and capture session access token and unique identifier
    const resA = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(userAData);
    userAToken = resA.body.accessToken;
    userAId = resA.body.user.id;

    // Register User B via HTTP endpoint and capture session access token and unique identifier
    const resB = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(userBData);
    userBToken = resB.body.accessToken;
    userBId = resB.body.user.id;
  });

  // ==========================================================================
  // GLOBAL TEST TEARDOWN: Clean up all test-generated entities and close connections
  // ==========================================================================
  afterAll(async () => {
    // Purge test-specific friendship associations safely
    await prismaService.friendship.deleteMany({
      where: {
        OR: [
          { sender: { username: { startsWith: 'e2e_lobby_' } } },
          { receiver: { username: { startsWith: 'e2e_lobby_' } } },
        ],
      },
    });
    // Purge test nodes associated with core test users, dummy occupants, and capacity boundary records
    await prismaService.node.deleteMany({
      where: {
        OR: [
          { user: { username: { startsWith: 'e2e_lobby_' } } },
          {
            user: { username: { startsWith: `dummy_lobby_user_${timestamp}` } },
          },
          {
            user: { username: { startsWith: `new_user_${timestamp}` } },
          },
          {
            user: { username: { startsWith: `dummy_limit_user_${timestamp}` } },
          },
        ],
      },
    });
    // Purge test users matching the test run timestamp signature
    await prismaService.user.deleteMany({
      where: {
        OR: [
          { username: { startsWith: 'e2e_lobby_' } },
          { username: { startsWith: `dummy_lobby_user_${timestamp}` } },
          { username: { startsWith: `new_user_${timestamp}` } },
          { username: { startsWith: `dummy_limit_user_${timestamp}` } },
        ],
      },
    });
    // Purge isolated test lobbies and any empty dangling lobby structures
    await prismaService.lobby.deleteMany({
      where: {
        OR: [
          { name: { contains: 'Full Lobby Test' } },
          { name: { contains: 'Capacity Limit Test' } },
          { nodes: { none: {} } },
        ],
      },
    });

    await prismaService.$disconnect();
    await app.close();
  });

  // ==========================================================================
  // TEST: GET /api/lobbies/my-lobby
  // ==========================================================================
  it('/api/lobbies/my-lobby (GET) - should assign and retrieve current user lobby', async () => {
    // Act: Request the active lobby assignment for User A using their authorization bearer token
    const response = await request(app.getHttpServer())
      .get('/api/lobbies/my-lobby')
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);

    // Assert: Verify that a valid lobby identifier, title, and initial occupant occupancy count are returned
    expect(response.body.id).toBeDefined();
    expect(response.body.name).toBeDefined();
    expect(response.body.occupantsCount).toBeGreaterThanOrEqual(1);
  });

  // ==========================================================================
  // TEST: POST /api/lobbies/join-friend
  // ==========================================================================
  it('/api/lobbies/join-friend (POST) - should reject switch request if target user is not an accepted friend', async () => {
    // Act & Assert: Attempt to migrate into User B's lobby without an established friendship, expecting a 400 Bad Request rejection
    await request(app.getHttpServer())
      .post('/api/lobbies/join-friend')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ friendId: userBId })
      .expect(400);
  });

  it('/api/lobbies/join-friend (POST) - should successfully switch to friend lobby when occupants are under capacity and friendship is accepted', async () => {
    // Arrange 1: Initialize User B's active spatial lobby room context via HTTP request
    await request(app.getHttpServer())
      .get('/api/lobbies/my-lobby')
      .set('Authorization', `Bearer ${userBToken}`)
      .expect(200);

    // Arrange 2: Programmatically establish an ACCEPTED friendship record between User A and User B in database
    await prismaService.friendship.create({
      data: {
        senderId: userAId,
        receiverId: userBId,
        status: 'ACCEPTED',
      },
    });

    // Act: Send a request from User A to switch spatial room context directly into User B's lobby
    const response = await request(app.getHttpServer())
      .post('/api/lobbies/join-friend')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ friendId: userBId })
      .expect(201);

    // Assert: Confirm successful room migration by validating the returned lobby identifier and increased occupant count
    expect(response.body.id).toBeDefined();
    expect(response.body.occupantsCount).toBeGreaterThanOrEqual(2);

    // Clean up: Remove the temporary friendship entity to isolate subsequent test scenarios
    await prismaService.friendship.deleteMany({
      where: { senderId: userAId, receiverId: userBId },
    });
  });

  it('/api/lobbies/join-friend (POST) - should reject switch request if friend lobby has reached maximum capacity (20/20)', async () => {
    // Arrange 1: Instantiate a custom lobby configured explicitly at its absolute maximum structural limit (20 occupants) and bind User B to it
    const fullLobby = await prismaService.lobby.create({
      data: {
        name: `Full Lobby Test ${timestamp}`,
        maxCapacity: 20,
      },
    });

    await prismaService.node.update({
      where: { userId: userBId },
      data: { lobbyId: fullLobby.id },
    });

    // Arrange 2: Seed the remaining 19 occupancy slots with valid dummy users and nodes to fulfill foreign key constraints and fill the room
    for (let i = 0; i < 19; i++) {
      const dummyUser = await prismaService.user.create({
        data: {
          username: `dummy_lobby_user_${timestamp}_${i}`,
          email: `dummy_${timestamp}_${i}@example.com`,
          password: 'dummy_password',
        },
      });

      await prismaService.node.create({
        data: {
          userId: dummyUser.id,
          posX: i,
          posY: i,
          status: 'IDLE',
          lobbyId: fullLobby.id,
        },
      });
    }

    // Arrange 3: Create an active ACCEPTED friendship relation linking User A and User B
    await prismaService.friendship.create({
      data: {
        senderId: userAId,
        receiverId: userBId,
        status: 'ACCEPTED',
      },
    });

    // Act: Execute the join-friend transfer request from User A targeting User B's completely full lobby room
    const response = await request(app.getHttpServer())
      .post('/api/lobbies/join-friend')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ friendId: userBId })
      .expect(400);

    // Assert: Verify that the transaction is rejected with an explicit description addressing the maximum capacity constraint
    expect(response.body.message).toContain('maximum capacity');
  });

  it('/api/lobbies/my-lobby (GET) - should create a new lobby if existing available lobbies have reached maximum capacity (20/20)', async () => {
    // Arrange 1: Setup a fully packed target lobby containing exactly 20 occupant nodes
    const packedLobby = await prismaService.lobby.create({
      data: {
        name: `Packed Lobby Test ${timestamp}`,
        maxCapacity: 20,
      },
    });

    for (let i = 0; i < 20; i++) {
      const packedUser = await prismaService.user.create({
        data: {
          username: `dummy_packed_user_${timestamp}_${i}`,
          email: `packed_${timestamp}_${i}@example.com`,
          password: 'dummy_password',
        },
      });

      await prismaService.node.create({
        data: {
          userId: packedUser.id,
          posX: i,
          posY: i,
          status: 'IDLE',
          lobbyId: packedLobby.id,
        },
      });
    }

    // Arrange 2: Register a completely separate unassigned user account via authentication endpoint
    const newUserCredentials = {
      username: `new_user_${timestamp}`,
      email: `new_user_${timestamp}@example.com`,
      password: 'SecurePassword123!',
      posX: 5,
      posY: 5,
    };

    const registerRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(newUserCredentials);

    const newUserToken = registerRes.body.accessToken;

    // Act: Request automatic spatial partition routing for this newly registered user
    const response = await request(app.getHttpServer())
      .get('/api/lobbies/my-lobby')
      .set('Authorization', `Bearer ${newUserToken}`)
      .expect(200);

    // Assert: Check that the spatial partitioning engine bypasses the full room, allocating a distinct new lobby with an initial count of 1
    expect(response.body.id).toBeDefined();
    expect(response.body.id).not.toEqual(packedLobby.id);
    expect(response.body.occupantsCount).toEqual(1);
  });

  it('/api/lobbies/my-lobby (GET) - should keep the first 20 users together in the same lobby and route the 21st user to a separate new lobby', async () => {
    // Arrange 1: Instantiate a shared target lobby container destined to reach its upper boundary limit
    const sharedLobby = await prismaService.lobby.create({
      data: {
        name: `Capacity Limit Test ${timestamp}`,
        maxCapacity: 20,
      },
    });

    const first20UserIds: string[] = [];

    // Arrange 2: Generate and assign precisely 20 users and nodes directly into the shared lobby via database operations
    for (let i = 0; i < 20; i++) {
      const limitUser = await prismaService.user.create({
        data: {
          username: `dummy_limit_user_${timestamp}_${i}`,
          email: `limit_${timestamp}_${i}@example.com`,
          password: 'dummy_password',
        },
      });

      first20UserIds.push(limitUser.id);

      await prismaService.node.create({
        data: {
          userId: limitUser.id,
          posX: i,
          posY: i,
          status: 'IDLE',
          lobbyId: sharedLobby.id,
        },
      });
    }

    // Arrange 3: Register an overflowing 21st user account through the standard HTTP registration gateway
    const user21RegRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        username: `dummy_limit_user_${timestamp}_21`,
        email: `limit_${timestamp}_21@example.com`,
        password: 'SecurePassword123!',
        posX: 21,
        posY: 21,
      });

    const user21Token = user21RegRes.body.accessToken;

    // Act: Invoke the spatial partitioning lookup routine for the 21st incoming user context
    const user21LobbyRes = await request(app.getHttpServer())
      .get('/api/lobbies/my-lobby')
      .set('Authorization', `Bearer ${user21Token}`)
      .expect(200);

    // Assert 1: Validate that the system successfully detours the overflow user into an isolated alternative room context
    expect(user21LobbyRes.body.id).toBeDefined();
    expect(user21LobbyRes.body.id).not.toEqual(sharedLobby.id);
    expect(user21LobbyRes.body.occupantsCount).toBeLessThanOrEqual(2);

    // Assert 2: Query database persistence directly to guarantee that the primary shared room's occupant count remains immutably fixed at 20
    const sharedLobbyCount = await prismaService.node.count({
      where: { lobbyId: sharedLobby.id },
    });
    expect(sharedLobbyCount).toEqual(20);
  });
});
