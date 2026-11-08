import { Controller, Get, Param, UseGuards, ForbiddenException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { JwtAuthGuard, AuthenticatedRequest } from '../common/jwt-auth.guard';
import { Req } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KycStatusResponse } from '../common/types';

@Controller('investors')
@UseGuards(JwtAuthGuard)
export class InvestorController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':id/kyc-status')
  async getKycStatus(@Param('id') id: string, @Req() req: AuthenticatedRequest): Promise<KycStatusResponse> {
    const claims = req.user;
    // Token is scoped to an investor as well as a tenant; prevent changing the route ID.
    if (claims.investor_id !== id) throw new ForbiddenException('Investor access denied');
    const investor = await this.prisma.investor.findUnique({
      where: { id },
      select: { id: true, email: true, kyc_status: true, tenant_id: true },
    });
    if (!investor) throw new NotFoundException('Investor not found');
    if (investor.tenant_id !== claims.tenant_id) throw new ForbiddenException('Tenant access denied');

    const latestEvent = await this.prisma.webhookEvent.findFirst({
      where: { investor_id: id }, orderBy: { processed_at: 'desc' }, select: { processed_at: true },
    });
    return {
      id: investor.id,
      email: investor.email,
      kyc_status: investor.kyc_status,
      last_updated: latestEvent?.processed_at.toISOString() ?? null,
    };
  }
}
