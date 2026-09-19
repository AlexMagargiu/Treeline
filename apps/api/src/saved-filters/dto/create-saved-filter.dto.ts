import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSavedFilterDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  // The URL query string, because filter state lives in the URL and a saved set is that
  // string with a name on it. Stored verbatim: parsing it here would give the API a second
  // opinion about what the filters mean.
  @IsString()
  @MaxLength(2000)
  query!: string;
}
