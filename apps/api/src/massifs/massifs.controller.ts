import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MassifRepository, MassifRow } from '../spatial/massif.repository';

@Controller('massifs')
export class MassifsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly massifs: MassifRepository,
  ) {}

  @Get()
  list(): Promise<MassifRow[]> {
    return this.massifs.list(this.prisma);
  }
}
