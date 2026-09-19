import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/public.decorator';

@Controller('health')
export class HealthController {
  // The one endpoint Docker and Caddy reach without a session.
  @Public()
  @Get()
  check(): { status: string } {
    return { status: 'ok' };
  }
}
