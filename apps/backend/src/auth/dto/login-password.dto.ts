import { IsString, MinLength } from 'class-validator';

export class LoginPasswordDto {
  @IsString()
  @MinLength(8)
  password!: string;
}
