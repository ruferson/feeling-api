import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealthCheck() {
    return {
      status: 'ok',
      service: 'FeelinG Backend API',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
