import { Module } from '@nestjs/common';
import { AccessPointRepository } from '../spatial/access-point.repository';
import { RoutesController } from './routes.controller';
import { RoutesService } from './routes.service';

@Module({
  controllers: [RoutesController],
  providers: [RoutesService, AccessPointRepository],
})
export class RoutesModule {}
