import { IsISO8601, IsIn, IsString, IsUUID, Length } from 'class-validator';

export class KycWebhookDto {
  @IsString() @Length(1, 200)
  event_id!: string;

  @IsUUID()
  investor_id!: string;

  @IsString() @IsIn(['pending', 'approved', 'rejected', 'under_review'])
  new_status!: string;

  @IsISO8601()
  timestamp!: string;
}
