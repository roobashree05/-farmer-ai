import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AppException } from '../common/app.exception';
import type { Actor } from '../common/actor';
import { CurrentUser } from '../common/current-user.decorator';
import { RequirePermissions } from '../common/decorators';
import { LeadImportService } from './lead-import.service';
import { LeadWorkspaceService } from './lead-workspace.service';
import {
  BulkLeadDto,
  CreateLeadDto,
  FollowUpDto,
  ImportCsvDto,
  LeadQueryDto,
  MergeLeadDto,
  NoteDto,
  UpdateLeadDto,
} from './leads.dto';
import { LeadsService } from './leads.service';

@ApiTags('leads')
@ApiBearerAuth()
@Controller('leads')
export class LeadsController {
  constructor(
    private readonly leads: LeadsService,
    private readonly imports: LeadImportService,
    private readonly workspace: LeadWorkspaceService,
  ) {}

  @Get()
  @RequirePermissions('leads.read')
  @ApiOperation({ summary: 'Search and page leads' })
  list(@Query() query: LeadQueryDto) {
    return this.leads.list(query);
  }

  @Get('imports')
  @RequirePermissions('leads.import')
  @ApiOperation({ summary: 'Lead import history' })
  importHistory(@Query() query: LeadQueryDto) {
    return this.imports.list(query);
  }

  @Post('import')
  @RequirePermissions('leads.import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        mapping: { type: 'string' },
      },
    },
  })
  @ApiOperation({ summary: 'Import leads from a CSV file' })
  importCsv(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: ImportCsvDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.imports.importCsv(file, body.mapping, actor);
  }

  @Post('import/whatsapp-group')
  @RequirePermissions('leads.import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Import the mock WhatsApp group, or an uploaded group JSON file' })
  importGroup(@UploadedFile() file: Express.Multer.File | undefined, @CurrentUser() actor: Actor) {
    return this.imports.importWhatsAppGroup(actor, file);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Assign, tag, update, delete, or campaign-select leads' })
  bulk(@Body() body: BulkLeadDto, @CurrentUser() actor: Actor) {
    const permission =
      body.action === 'delete' ? 'leads.delete' : body.action === 'assign' ? 'leads.assign' : 'leads.write';
    const allowed =
      actor.permissions.includes(permission) ||
      (body.action === 'campaign' && actor.permissions.includes('campaigns.write'));
    if (!allowed) {
      throw new AppException('FORBIDDEN', 'You do not have permission for this bulk action', 403);
    }
    return this.leads.bulk(body, actor);
  }

  @Post('merge')
  @RequirePermissions('leads.merge')
  @ApiOperation({ summary: 'Merge a duplicate lead into a primary lead' })
  merge(@Body() body: MergeLeadDto, @CurrentUser() actor: Actor) {
    return this.leads.merge(body.primaryId, body.duplicateId, actor);
  }

  @Get('export')
  @RequirePermissions('leads.read')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: 'Export filtered leads as CSV' })
  async export(@Query() query: LeadQueryDto, @Res() response: Response) {
    const csv = await this.leads.exportCsv(query);
    response.setHeader('Content-Disposition', 'attachment; filename="leads.csv"');
    response.send(csv);
  }

  @Post()
  @RequirePermissions('leads.write')
  @ApiOperation({ summary: 'Create a lead' })
  create(@Body() body: CreateLeadDto, @CurrentUser() actor: Actor) {
    return this.leads.create(body, actor);
  }

  @Get(':id/workspace')
  @RequirePermissions('leads.read')
  @ApiOperation({ summary: 'Customer 360 payload for a lead' })
  workspaceByLead(@Param('id') id: string, @CurrentUser() actor: Actor) {
    return this.workspace.byLeadId(id, actor);
  }

  @Get(':id/timeline')
  @RequirePermissions('leads.read')
  @ApiOperation({ summary: 'Lead activity timeline' })
  async timeline(@Param('id') id: string, @CurrentUser() actor: Actor) {
    const data = await this.workspace.byLeadId(id, actor);
    return data.timeline;
  }

  @Get(':id')
  @RequirePermissions('leads.read')
  @ApiOperation({ summary: 'Get one lead' })
  get(@Param('id') id: string) {
    return this.leads.get(id);
  }

  @Patch(':id')
  @RequirePermissions('leads.write')
  @ApiOperation({ summary: 'Update a lead' })
  update(@Param('id') id: string, @Body() body: UpdateLeadDto, @CurrentUser() actor: Actor) {
    return this.leads.update(id, body, actor);
  }

  @Delete(':id')
  @RequirePermissions('leads.delete')
  @ApiOperation({ summary: 'Soft-delete a lead' })
  remove(@Param('id') id: string, @CurrentUser() actor: Actor) {
    return this.leads.remove(id, actor);
  }

  @Post(':id/notes')
  @RequirePermissions('leads.write')
  @ApiOperation({ summary: 'Add a note' })
  note(@Param('id') id: string, @Body() body: NoteDto, @CurrentUser() actor: Actor) {
    return this.leads.addNote(id, body.body, actor);
  }

  @Post(':id/follow-ups')
  @RequirePermissions('leads.write')
  @ApiOperation({ summary: 'Create a follow-up' })
  followUp(@Param('id') id: string, @Body() body: FollowUpDto, @CurrentUser() actor: Actor) {
    return this.leads.addFollowUp(id, body, actor);
  }

  @Post(':id/convert')
  @RequirePermissions('customers.write')
  @ApiOperation({ summary: 'Convert a lead into a customer' })
  convert(@Param('id') id: string, @CurrentUser() actor: Actor) {
    return this.leads.convert(id, actor);
  }
}
