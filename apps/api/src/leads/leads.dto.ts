import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

function blankToUndefined({ value }: { value: unknown }) {
  return typeof value === 'string' && value.trim() === '' ? undefined : value;
}
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { PageQueryDto } from '../common/page.dto';

export class CreateLeadDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  whatsappNumber?: string;

  @ApiPropertyOptional()
  @Transform(blankToUndefined)
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shopName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ default: 'MANUAL' })
  @IsOptional()
  @IsString()
  leadSource?: string;

  @ApiPropertyOptional({ default: 'NEW' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedUserId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerCategory?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  previousEnquiry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  nextFollowUpAt?: string;
}

export class UpdateLeadDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  whatsappNumber?: string;

  @ApiPropertyOptional()
  @Transform(blankToUndefined)
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shopName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  leadSource?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedUserId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerCategory?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  previousEnquiry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  nextFollowUpAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  lastContactAt?: string;
}

export class LeadQueryDto extends PageQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  campaignId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  dateTo?: string;

  @ApiPropertyOptional({ enum: ['name', 'shopName', 'createdAt', 'updatedAt', 'displayId'] })
  @IsOptional()
  @IsIn(['name', 'shopName', 'createdAt', 'updatedAt', 'displayId'])
  sortBy?: 'name' | 'shopName' | 'createdAt' | 'updatedAt' | 'displayId';
}

export class NoteDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  body!: string;
}

export class FollowUpDto {
  @ApiProperty()
  @IsISO8601()
  dueAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;
}

export class BulkLeadDto {
  @ApiProperty({ enum: ['assign', 'tag', 'status', 'delete', 'followup', 'campaign'] })
  @IsIn(['assign', 'tag', 'status', 'delete', 'followup', 'campaign'])
  action!: 'assign' | 'tag' | 'status' | 'delete' | 'followup' | 'campaign';

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  ids!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  dueAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  campaignName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  template?: string;
}

export class MergeLeadDto {
  @ApiProperty()
  @IsString()
  primaryId!: string;

  @ApiProperty()
  @IsString()
  duplicateId!: string;
}

export class ImportCsvDto {
  @ApiPropertyOptional({ description: 'JSON object mapping canonical fields to CSV headers' })
  @IsOptional()
  @IsString()
  mapping?: string;
}

export class LeadExportQueryDto extends LeadQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  declare page?: number;
}
