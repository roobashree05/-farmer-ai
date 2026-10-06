import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { ROLE_NAMES } from '@aijewel/shared';

export class CreateUserDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  firstName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  lastName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ enum: ROLE_NAMES })
  @IsIn(ROLE_NAMES)
  role!: (typeof ROLE_NAMES)[number];
}

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: ROLE_NAMES })
  @IsOptional()
  @IsIn(ROLE_NAMES)
  role?: (typeof ROLE_NAMES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}
