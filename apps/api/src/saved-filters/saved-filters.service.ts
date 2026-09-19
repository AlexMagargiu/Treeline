import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApiError } from '../common/api-error';
import { config } from '../common/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSavedFilterDto } from './dto/create-saved-filter.dto';

interface SavedFilterRow {
  id: string;
  name: string;
  query: string;
  createdAt: string;
}

// Every one of the three filters on owner_id, which is the seed constant until accounts
// exist. The column and the filter are here now because retrofitting ownership is
// expensive, and because the day a second person arrives nothing about these queries has
// to change.
@Injectable()
export class SavedFiltersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<SavedFilterRow[]> {
    const rows = await this.prisma.savedFilter.findMany({
      where: { ownerId: config.ownerId },
      orderBy: { name: 'asc' },
    });
    return rows.map(toRow);
  }

  async create(body: CreateSavedFilterDto): Promise<SavedFilterRow> {
    try {
      const row = await this.prisma.savedFilter.create({
        data: { ownerId: config.ownerId, name: body.name, query: body.query },
      });
      return toRow(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ApiError(409, 'name_taken', 'A saved filter already has that name.');
      }
      throw error;
    }
  }

  // 404 rather than 403 for a row somebody else owns. That another owner has a filter
  // with this id is not this caller's business, and a 403 would tell them it exists.
  async remove(id: string): Promise<void> {
    const { count } = await this.prisma.savedFilter.deleteMany({
      where: { id, ownerId: config.ownerId },
    });
    if (count === 0) {
      throw new ApiError(404, 'saved_filter_not_found', 'No saved filter with that id.');
    }
  }
}

function toRow(row: { id: string; name: string; query: string; createdAt: Date }): SavedFilterRow {
  return {
    id: row.id,
    name: row.name,
    query: row.query,
    createdAt: row.createdAt.toISOString(),
  };
}
