import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@aijewel.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Local-demo-1234' })
  @IsString()
  @MinLength(8)
  password!: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  @MinLength(20)
  refreshToken!: string;
}
