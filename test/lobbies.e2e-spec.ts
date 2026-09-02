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

    // Register User A and capture session credentials
    const resA = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(userAData);
    userAToken = resA.body.accessToken;
    userAId = resA.body.user.id;

    // Register User B and capture session credentials
    const resB = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(userBData);
    userBToken = resB.body.accessToken;
    userBId = resB.body.user.id;
  });

  // ==========================================================================
  // GLOBAL TEST TEARDOWN
  // ==========================================================================
  afterAll(async () => {
    await prismaService.friendship.deleteMany({
      where: {
        OR: [
          { sender: { username: { startsWith: 'e2e_lobby_' } } },
          { receiver: { username: { startsWith: 'e2e_lobby_' } } },
        ],
      },
    });
    await prismaService.node.deleteMany({
      where: { user: { username: { startsWith: 'e2e_lobby_' } } },
    });
    await prismaService.user.deleteMany({
      where: { username: { startsWith: 'e2e_lobby_' } },
    });
    await prismaService.lobby.deleteMany({
      where: {
        nodes: {
          none: {},
        },
      },
    });

    await prismaService.$disconnect();
    await app.close();
  });

  // ==========================================================================
  // TEST: GET /api/lobbies/my-lobby
  // ==========================================================================
  it('/api/lobbies/my-lobby (GET) - should assign and retrieve current user lobby', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/lobbies/my-lobby')
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);

    expect(response.body.id).toBeDefined();
    expect(response.body.name).toBeDefined();
    expect(response.body.occupantsCount).toBeGreaterThanOrEqual(1);
  });

  // ==========================================================================
  // TEST: POST /api/lobbies/join-friend
  // ==========================================================================
  it('/api/lobbies/join-friend (POST) - should reject switch request if target user is not an accepted friend', async () => {
    await request(app.getHttpServer())
      .post('/api/lobbies/join-friend')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ friendId: userBId })
      .expect(400);
  });
});
