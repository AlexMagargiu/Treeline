import { Module } from '@nestjs/common';
import { MassifRepository } from '../spatial/massif.repository';
import { MassifsController } from './massifs.controller';

@Module({
  controllers: [MassifsController],
  providers: [MassifRepository],
})
export class MassifsModule {}
