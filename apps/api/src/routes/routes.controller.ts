import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { VALIDATE, VALIDATE_EDITS } from '../common/validation';
import { ListRoutesDto } from './dto/list-routes.dto';
import { PatchRouteDto } from './dto/patch-route.dto';
import { RoutesService } from './routes.service';

const UUID = new ParseUUIDPipe({
  exceptionFactory: () => new ApiError(400, 'invalid_request', 'That is not a route id.'),
});

@Controller('routes')
export class RoutesController {
  constructor(private readonly routes: RoutesService) {}

  @Get()
  list(@Query(VALIDATE) query: ListRoutesDto) {
    return this.routes.list(query);
  }

  @Get(':id')
  detail(@Param('id', UUID) id: string) {
    return this.routes.detail(id);
  }

  @Patch(':id')
  patch(@Param('id', UUID) id: string, @Body(VALIDATE_EDITS) body: PatchRouteDto) {
    return this.routes.patch(id, body);
  }
}
