import { AccessMode, Confidence, RouteCategoryName, Season } from '@prisma/client';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const SORTS = ['fit', 'km', 'ascent', 'difficulty', 'dayLength', 'name'] as const;
export type Sort = (typeof SORTS)[number];

export const TRIP_TYPES = ['1 day', '1 long day', '2 days'] as const;

// A distance, an ascent bound or a travel time stays the string the caller sent and is
// cast to numeric in the statement. Turning it into a JavaScript number first would put a
// float in front of the one query the view was written to keep exact.
const DECIMAL = /^\d{1,6}(\.\d{1,4})?$/;

/** ?massif=a is one value and ?massif=a&massif=b is two. Both become a list. */
const toArray = ({ value }: TransformFnParams): unknown =>
  value === undefined ? undefined : Array.isArray(value) ? value : [value];

const toIntArray = ({ value }: TransformFnParams): unknown => {
  if (value === undefined) return undefined;
  return (Array.isArray(value) ? value : [value]).map((item) => Number(item));
};

const toBoolean = ({ value }: TransformFnParams): unknown =>
  value === undefined ? undefined : value === true || value === 'true' || value === '1';

export class ListRoutesDto {
  @IsOptional()
  @Transform(toArray)
  @IsUUID('all', { each: true })
  massif?: string[];

  @IsOptional()
  @Transform(toArray)
  @IsEnum(RouteCategoryName, { each: true })
  category?: RouteCategoryName[];

  @IsOptional()
  @IsEnum(Season)
  season?: Season;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  maxDifficulty?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9)
  maxTechnical?: number;

  @IsOptional()
  @Matches(DECIMAL)
  maxKm?: string;

  @IsOptional()
  @Matches(DECIMAL)
  minKm?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxAscent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minAscent?: number;

  @IsOptional()
  @Matches(DECIMAL)
  maxDayLength?: string;

  @IsOptional()
  @Matches(DECIMAL)
  maxTrainH?: string;

  @IsOptional()
  @IsIn(TRIP_TYPES)
  tripType?: (typeof TRIP_TYPES)[number];

  @IsOptional()
  @Transform(toIntArray)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(5, { each: true })
  stage?: number[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  minQuiet?: number;

  @IsOptional()
  @Transform(toArray)
  @IsEnum(Confidence, { each: true })
  confidence?: Confidence[];

  @IsOptional()
  @IsEnum(AccessMode)
  mode?: AccessMode;

  @IsOptional()
  @Transform(toArray)
  @IsUUID('all', { each: true })
  startStation?: string[];

  // Accepted and answered, never applied. visit arrives in phase 4, so in phase 1 every
  // route is one you have not walked. The response says so in notWalkedApplied.
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  notWalked?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsIn(SORTS)
  sort?: Sort;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
