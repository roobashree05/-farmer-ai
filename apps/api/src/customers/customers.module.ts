import { Module } from '@nestjs/common';
import { LeadsModule } from '../leads/leads.module';
import { CustomersController } from './customers.controller';

@Module({
  imports: [LeadsModule],
  controllers: [CustomersController],
})
export class CustomersModule {}
