import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';
import type { Actor } from '../common/actor';
import { CurrentUser } from '../common/current-user.decorator';
import { RequirePermissions } from '../common/decorators';
import { KnowledgeService } from './knowledge.service';

class CategoryDto {
  @IsString()
  category!: string;

  @IsString()
  @MinLength(1)
  name!: string;
}

class CategoryPatchDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class DocumentDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  content!: string;
}

class DocumentPatchDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@ApiTags('knowledge-base')
@ApiBearerAuth()
@Controller('knowledge-base')
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Get()
  @RequirePermissions('knowledge.read')
  @ApiOperation({ summary: 'List knowledge entries grouped by category' })
  list(@Query('category') category?: string) {
    return this.knowledge.list(category);
  }

  @Post()
  @RequirePermissions('knowledge.write')
  @ApiOperation({ summary: 'Create a knowledge category' })
  create(@Body() body: CategoryDto, @CurrentUser() actor: Actor) {
    return this.knowledge.createCategory(body, actor);
  }

  @Patch(':id')
  @RequirePermissions('knowledge.write')
  @ApiOperation({ summary: 'Rename or activate a knowledge category' })
  update(@Param('id') id: string, @Body() body: CategoryPatchDto, @CurrentUser() actor: Actor) {
    return this.knowledge.updateCategory(id, body, actor);
  }

  @Delete(':id')
  @RequirePermissions('knowledge.write')
  @ApiOperation({ summary: 'Delete a knowledge category' })
  remove(@Param('id') id: string, @CurrentUser() actor: Actor) {
    return this.knowledge.removeCategory(id, actor);
  }

  @Post(':id/documents')
  @RequirePermissions('knowledge.write')
  @ApiOperation({ summary: 'Add a knowledge entry' })
  addDocument(@Param('id') id: string, @Body() body: DocumentDto, @CurrentUser() actor: Actor) {
    return this.knowledge.addDocument(id, body, actor);
  }

  @Patch('documents/:documentId')
  @RequirePermissions('knowledge.write')
  @ApiOperation({ summary: 'Edit or activate a knowledge entry' })
  updateDocument(@Param('documentId') id: string, @Body() body: DocumentPatchDto, @CurrentUser() actor: Actor) {
    return this.knowledge.updateDocument(id, body, actor);
  }

  @Delete('documents/:documentId')
  @RequirePermissions('knowledge.write')
  @ApiOperation({ summary: 'Delete a knowledge entry' })
  removeDocument(@Param('documentId') id: string, @CurrentUser() actor: Actor) {
    return this.knowledge.removeDocument(id, actor);
  }
}
