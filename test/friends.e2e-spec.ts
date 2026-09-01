import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// ============================================================================
// E2E TEST SUITE: FriendsController & Friendship Workflow
// ============================================================================
describe('FriendsController (E2E)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  let userAToken: string;
  let userBToken: string;
  let userBUsername: string;
  let friendshipId: string;

  const timestamp = Date.now();
  const userAData = {
    username: `e2e_friend_a_${timestamp}`,
    email: `e2e_a_${timestamp}@example.com`,
    password: 'SecurePassword123!',
    posX: 0,
    posY: 0,
  };

  const userBData = {
    username: `e2e_friend_b_${timestamp}`,
    email: `e2e_b_${timestamp}@example.com`,
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

    // Register User A and capture token
    const resA = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(userAData);
    userAToken = resA.body.accessToken;

    // Register User B, capture token and username
    const resB = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(userBData);
    userBToken = resB.body.accessToken;
    userBUsername = userBData.username;
  });

  // ==========================================================================
  // GLOBAL TEST TEARDOWN
  // ==========================================================================
  afterAll(async () => {
    await prismaService.friendship.deleteMany({
      where: {
        OR: [
          { sender: { username: { startsWith: 'e2e_friend_' } } },
          { receiver: { username: { startsWith: 'e2e_friend_' } } },
        ],
      },
    });
    await prismaService.node.deleteMany({
      where: { user: { username: { startsWith: 'e2e_friend_' } } },
    });
    await prismaService.user.deleteMany({
      where: { username: { startsWith: 'e2e_friend_' } },
    });
    await prismaService.$disconnect();
    await app.close();
  });

  // ==========================================================================
  // TEST: POST /api/friends/request
  // ==========================================================================
  it('/api/friends/request (POST) - should allow User A to send a friend request to User B', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/friends/request')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ username: userBUsername })
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body.status).toEqual('PENDING');
    friendshipId = response.body.id;
  });

  it('/api/friends/request (POST) - should return 400 BadRequest when sending request to oneself', async () => {
    await request(app.getHttpServer())
      .post('/api/friends/request')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ username: userAData.username })
      .expect(400);
  });

  // ==========================================================================
  // TEST: GET /api/friends/sent & /api/friends/pending
  // ==========================================================================
  it('/api/friends/sent (GET) - should list pending requests sent by User A', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/friends/sent')
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body[0].id).toEqual(friendshipId);
  });

  it('/api/friends/pending (GET) - should list pending incoming requests for User B', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/friends/pending')
      .set('Authorization', `Bearer ${userBToken}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body[0].id).toEqual(friendshipId);
  });

  // ==========================================================================
  // TEST: POST /api/friends/accept/:id
  // ==========================================================================
  it('/api/friends/accept/:id (POST) - should allow User B to accept the friend request', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/friends/accept/${friendshipId}`)
      .set('Authorization', `Bearer ${userBToken}`)
      .expect(201);

    expect(response.body.status).toEqual('ACCEPTED');
  });

  // ==========================================================================
  // TEST: GET /api/friends
  // ==========================================================================
  it('/api/friends (GET) - should return active friends list for both users', async () => {
    const responseA = await request(app.getHttpServer())
      .get('/api/friends')
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);

    expect(responseA.body.length).toBe(1);
    expect(responseA.body[0].username).toEqual(userBUsername);

    const responseB = await request(app.getHttpServer())
      .get('/api/friends')
      .set('Authorization', `Bearer ${userBToken}`)
      .expect(200);

    expect(responseB.body.length).toBe(1);
    expect(responseB.body[0].username).toEqual(userAData.username);
  });

  // ==========================================================================
  // TEST: DELETE /api/friends/:id
  // ==========================================================================
  it('/api/friends/:id (DELETE) - should allow removing an active friendship', async () => {
    await request(app.getHttpServer())
      .delete(`/api/friends/${friendshipId}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);

    // Verify friends list is now empty for User A
    const response = await request(app.getHttpServer())
      .get('/api/friends')
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);

    expect(response.body.length).toBe(0);
  });
});
