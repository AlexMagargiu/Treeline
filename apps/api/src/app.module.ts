import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { SessionGuard } from './auth/session.guard';
import { ApiErrorFilter } from './common/api-error.filter';
import { HealthController } from './health/health.controller';
import { MassifsModule } from './massifs/massifs.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { RoutesModule } from './routes/routes.module';
import { SavedFiltersModule } from './saved-filters/saved-filters.module';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    AuthModule,
    MassifsModule,
    RoutesModule,
    SavedFiltersModule,
  ],
  controllers: [HealthController],
  providers: [
    // The guard is global, so a controller added later is behind the password unless it
    // says @Public(). Forgetting a guard leaks the catalogue; forgetting @Public() only
    // breaks the endpoint you are writing.
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_FILTER, useClass: ApiErrorFilter },
  ],
})
export class AppModule {}
