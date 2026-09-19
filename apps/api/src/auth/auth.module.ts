import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginRateLimiter } from './login-rate-limiter';

@Module({
  controllers: [AuthController],
  providers: [AuthService, LoginRateLimiter],
  exports: [AuthService],
})
export class AuthModule {}
