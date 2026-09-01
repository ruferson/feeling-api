import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// ============================================================================
// E2E TEST SUITE: AuthController & Authentication Flow
// ============================================================================
describe('AuthController (E2E)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  // Generate unique test credentials to prevent database collision during parallel runs
  const testUser = {
    username: 'e2e_auth_u_' + Date.now(),
    email: `e2e_auth_${Date.now()}@example.com`,
    password: 'SecurePassword123!',
    posX: 0,
    posY: 0,
  };

  let accessToken: string;

  // ==========================================================================
  // GLOBAL TEST SETUP
  // ==========================================================================
  beforeAll(async () => {
    // Build the complete NestJS application fixture with all production modules
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Register global prefix matching main.ts configuration
    app.setGlobalPrefix('api');

    // Register global validation pipes to match main.ts configuration
    app.useGlobalPipes(new ValidationPipe());

    await app.init();

    // Retrieve Prisma database instance for test state cleanups
    prismaService = app.get(PrismaService);
  });

  // ==========================================================================
  // GLOBAL TEST TEARDOWN
  // ==========================================================================
  afterAll(async () => {
    await prismaService.node.deleteMany({
      where: { user: { username: { startsWith: 'e2e_auth_u_' } } },
    });
    await prismaService.user.deleteMany({
      where: { username: { startsWith: 'e2e_auth_u_' } },
    });
    await prismaService.$disconnect();
    await app.close();
  });

  // ==========================================================================
  // TEST: POST /api/auth/register
  // ==========================================================================
  it('/api/auth/register (POST) - should register a new user successfully', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(testUser)
      .expect(201);

    expect(response.body).toHaveProperty('accessToken');
    expect(response.body).toHaveProperty('user');

    accessToken = response.body.accessToken;
  });

  it('/api/auth/register (POST) - should return 409 Conflict if email or username is already taken', async () => {
    // Attempt to register again with the exact same user data
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(testUser)
      .expect(409);
  });

  // ==========================================================================
  // TEST: POST /api/auth/login
  // ==========================================================================
  it('/api/auth/login (POST) - should authenticate the user and return a token', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        username: testUser.username,
        password: testUser.password,
      })
      .expect(200);

    expect(response.body).toHaveProperty('accessToken');
    accessToken = response.body.accessToken;
  });

  it('/api/auth/login (POST) - should return 401 Unauthorized with invalid credentials', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        username: testUser.username,
        password: 'WrongPassword!',
      })
      .expect(401);
  });

  // ==========================================================================
  // TEST: GET /api/auth/profile (Protected Route with Guards)
  // ==========================================================================
  it('/api/auth/profile (GET) - should return user profile when valid JWT is provided', async () => {
    // Ensure we have a token from login or register
    const tokenToUse = accessToken;

    const response = await request(app.getHttpServer())
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${tokenToUse}`)
      .expect(200);

    // Verify returned profile information matches the registered user
    expect(response.body).toHaveProperty('id');
    expect(response.body.username).toEqual(testUser.username);
  });

  it('/api/auth/profile (GET) - should return 401 Unauthorized if token is missing', async () => {
    // Attempt accessing protected route without credentials and expect 401 rejection
    await request(app.getHttpServer()).get('/api/auth/profile').expect(401);
  });
});
