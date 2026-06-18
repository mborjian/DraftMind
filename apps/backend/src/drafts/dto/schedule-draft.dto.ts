import { IsString } from 'class-validator';

export class ScheduleDraftDto {
  @IsString()
  scheduledFor!: string;
}
