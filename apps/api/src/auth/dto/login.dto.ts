import { IsString, MaxLength } from 'class-validator';

export class LoginDto {
  // No minimum length. The rule about what a good password is belongs to whoever
  // generates the hash, and a minimum here would tell a guesser what not to try.
  @IsString()
  @MaxLength(1024)
  password!: string;
}
