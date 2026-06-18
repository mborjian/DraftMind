import { Body, Controller, Get, Post } from '@nestjs/common';
import { CompleteSetupDto } from './dto/complete-setup.dto';
import { SetupService } from './setup.service';

@Controller('setup')
export class SetupController {
  constructor(private readonly setupService: SetupService) {}

  @Get('status')
  getStatus() {
    return {
      success: true,
      data: this.setupService.getStatus(),
    };
  }

  @Post('complete')
  async completeSetup(@Body() dto: CompleteSetupDto) {
    return {
      success: true,
      data: await this.setupService.completeSetup(dto),
    };
  }
}
