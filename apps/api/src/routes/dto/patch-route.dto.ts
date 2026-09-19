import { Confidence, Technical, Terrain } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

// numeric(5,2): three digits before the point and two after. A distance outside that
// range is a typo, not a route.
const KM = /^\d{1,3}(\.\d{1,2})?$/;

/**
 * Absent and null are different edits: absent leaves the column alone, null clears it.
 * @IsOptional() skips validation for both, which is right for a nullable column and wrong
 * for a NOT NULL one, so the NOT NULL columns validate whenever the key is present and
 * refuse the null.
 */
const PRESENT = (_object: PatchRouteDto, value: unknown): boolean => value !== undefined;

export class PatchRouteDto {
  @ValidateIf(PRESENT)
  @IsString()
  @MaxLength(200)
  nameRo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  nameEn?: string | null;

  @ValidateIf(PRESENT)
  @Matches(KM)
  km?: string;

  @ValidateIf(PRESENT)
  @IsInt()
  @Min(0)
  @Max(10000)
  ascentM?: number;

  @ValidateIf(PRESENT)
  @IsEnum(Terrain)
  terrain?: Terrain;

  @ValidateIf(PRESENT)
  @IsEnum(Technical)
  technical?: Technical;

  @ValidateIf(PRESENT)
  @IsInt()
  @Min(1)
  @Max(5)
  quiet?: number;

  @ValidateIf(PRESENT)
  @IsEnum(Confidence)
  confidence?: Confidence;

  @ValidateIf(PRESENT)
  @IsString()
  @MaxLength(100)
  seasonWindow?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  notes?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  shape?: string | null;
}
