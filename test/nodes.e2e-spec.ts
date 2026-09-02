import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// ============================================================================
// E2E TEST SUITE: NodesController & Nodes/Spotify Visibility Workflow
// ============================================================================
describe('NodesController (E2E)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  let userAToken: string;
  let userBToken: string;
  let userAId: string;
  let userBId: string;
  let sharedLobbyId: string;

  const timestamp = Date.now();
  const userAData = {
    username: `e2e_node_a_${timestamp}`,
    email: `node_a_${timestamp}@example.com`,
    password: 'SecurePassword123!',
    posX: 10,
    posY: 10,
  };

  const userBData = {
    username: `e2e_node_b_${timestamp}`,
    email: `node_b_${timestamp}@example.com`,
    password: 'SecurePassword123!',
    posX: 20,
    posY: 20,
  };

  // ==========================================================================
  // GLOBAL TEST SETUP
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

    // 1. Create a shared lobby entity for the E2E test suite
    const sharedLobby = await prismaService.lobby.create({
      data: {
        name: 'E2E Test Shared Lobby v1.0.0',
        maxCapacity: 20,
      },
    });
    sharedLobbyId = sharedLobby.id;

    // 2. Register User A and capture session details
    const resA = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(userAData);
    userAToken = resA.body.accessToken;
    userAId = resA.body.user.id;

    // 3. Register User B and capture session details
    const resB = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(userBData);
    userBToken = resB.body.accessToken;
    userBId = resB.body.user.id;

    // 4. Assign both users to the same shared lobby and seed mock Spotify data on User B
    await prismaService.node.update({
      where: { userId: userAId },
      data: { lobbyId: sharedLobbyId },
    });

    await prismaService.node.update({
      where: { userId: userBId },
      data: {
        lobbyId: sharedLobbyId,
        songTitle: 'Secret Song',
        artist: 'Secret Artist',
        isPlaying: true,
        bpm: 128,
      },
    });
  });

  // ==========================================================================
  // GLOBAL TEST TEARDOWN
  // ==========================================================================
  afterAll(async () => {
    await prismaService.friendship.deleteMany({
      where: {
        OR: [
          { sender: { username: { startsWith: 'e2e_node_' } } },
          { receiver: { username: { startsWith: 'e2e_node_' } } },
        ],
      },
    });
    await prismaService.node.deleteMany({
      where: { user: { username: { startsWith: 'e2e_node_' } } },
    });
    await prismaService.user.deleteMany({
      where: { username: { startsWith: 'e2e_node_' } },
    });
    await prismaService.lobby.deleteMany({
      where: { id: sharedLobbyId },
    });

    await prismaService.$disconnect();
    await app.close();
  });

  // ==========================================================================
  // TEST: PATCH /api/nodes/location
  // ==========================================================================
  it('/api/nodes/location (PATCH) - should successfully update authenticated user node coordinates', async () => {
    const newLocation = { posX: 55.5, posY: 66.6, bpm: 140 };

    const response = await request(app.getHttpServer())
      .patch('/api/nodes/location')
      .set('Authorization', `Bearer ${userAToken}`)
      .send(newLocation)
      .expect(200);

    expect(response.body.posX).toEqual(newLocation.posX);
    expect(response.body.posY).toEqual(newLocation.posY);
    expect(response.body.bpm).toEqual(newLocation.bpm);
  });

  it('/api/nodes/location (PATCH) - should return 400 BadRequest if coordinates payload is invalid', async () => {
    await request(app.getHttpServer())
      .patch('/api/nodes/location')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ posX: 'invalid_string', posY: 0 })
      .expect(400);
  });

  // ==========================================================================
  // TEST: GET /api/nodes (Visibility Rules: Strangers vs Friends)
  // ==========================================================================
  it('/api/nodes (GET) - should mask Spotify details for non-friend users (strangers)', async () => {
    // Before establishing friendship, User A views nodes list
    const response = await request(app.getHttpServer())
      .get('/api/nodes')
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    const nodeB = response.body.find((n: any) => n.id === userBId);

    // Node should be visible within the same lobby, but Spotify data masked
    expect(nodeB).toBeDefined();
    expect(nodeB.songTitle).toEqual('');
    expect(nodeB.artist).toEqual('');
    expect(nodeB.isPlaying).toBe(false);
    expect(nodeB.bpm).toEqual(0);
  });

  it('/api/nodes (GET) - should reveal Spotify details once users become accepted friends', async () => {
    // 1. User A sends friend request to User B
    const reqRes = await request(app.getHttpServer())
      .post('/api/friends/request')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ username: userBData.username })
      .expect(201);

    const friendshipId = reqRes.body.id;

    // 2. User B accepts the request
    await request(app.getHttpServer())
      .post(`/api/friends/accept/${friendshipId}`)
      .set('Authorization', `Bearer ${userBToken}`)
      .expect(201);

    // 3. User A queries nodes again; Spotify details should now be visible
    const response = await request(app.getHttpServer())
      .get('/api/nodes')
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);

    const nodeB = response.body.find((n: any) => n.id === userBId);
    expect(nodeB).toBeDefined();
    expect(nodeB.songTitle).toEqual('Secret Song');
    expect(nodeB.artist).toEqual('Secret Artist');
    expect(nodeB.isPlaying).toBe(true);
    expect(nodeB.bpm).toEqual(128);
  });
});
