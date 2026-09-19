import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { VALIDATE } from '../common/validation';
import { CreateSavedFilterDto } from './dto/create-saved-filter.dto';
import { SavedFiltersService } from './saved-filters.service';

const UUID = new ParseUUIDPipe({
  exceptionFactory: () =>
    new ApiError(400, 'invalid_request', 'That is not a saved filter id.'),
});

@Controller('saved-filters')
export class SavedFiltersController {
  constructor(private readonly savedFilters: SavedFiltersService) {}

  @Get()
  list() {
    return this.savedFilters.list();
  }

  @Post()
  create(@Body(VALIDATE) body: CreateSavedFilterDto) {
    return this.savedFilters.create(body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', UUID) id: string) {
    return this.savedFilters.remove(id);
  }
}
