import { Controller, Get, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';
import { CostsService } from './costs.service';

@Controller('costs')
@UseGuards(SessionAuthGuard)
export class CostsController {
  constructor(private readonly costsService: CostsService) {}

  @Get()
  getCosts() {
    return { success: true, data: this.costsService.getCosts() };
  }
}
