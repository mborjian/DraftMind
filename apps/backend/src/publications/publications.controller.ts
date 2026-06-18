import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';
import { PublicationsService } from './publications.service';

@Controller('publications')
@UseGuards(SessionAuthGuard)
export class PublicationsController {
  constructor(private readonly publicationsService: PublicationsService) {}

  @Get()
  listPublications() {
    return { success: true, data: this.publicationsService.listPublications() };
  }

  @Get(':id')
  getPublication(@Param('id', ParseIntPipe) id: number) {
    return { success: true, data: this.publicationsService.getPublication(id) };
  }
}
