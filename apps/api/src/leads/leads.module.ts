import { Module } from '@nestjs/common';
import { LeadImportService } from './lead-import.service';
import { LeadWorkspaceService } from './lead-workspace.service';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  controllers: [LeadsController],
  providers: [LeadsService, LeadImportService, LeadWorkspaceService],
  exports: [LeadsService, LeadWorkspaceService],
})
export class LeadsModule {}
