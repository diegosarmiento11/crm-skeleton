import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { TeamGuard } from '../common/guards/team.guard';
import { RequireArea, CurrentTeamUser, type RequestTeamUser } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import { SaveViewPrefDto } from './dto/crm.dto';

// Configuración de tabla por usuario (orden/anchos/visibilidad). Es la única
// pieza del CRM donde el controlador habla con Prisma directo: dos consultas de
// una tabla propia, sin lógica. Si crece, pasa a un servicio.
@Controller('api/v1/crm/view-prefs')
@UseGuards(TeamGuard)
@RequireArea('crm')
export class ViewPrefsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':entity')
  async get(@Param('entity') entity: string, @CurrentTeamUser() user: RequestTeamUser) {
    const pref = await this.prisma.crmViewPref.findUnique({
      where: { user_email_entity: { user_email: user.email, entity } },
    });
    return { entity, config: pref?.config ?? null };
  }

  @Put(':entity')
  async save(
    @Param('entity') entity: string,
    @Body() dto: SaveViewPrefDto,
    @CurrentTeamUser() user: RequestTeamUser,
  ) {
    const config = dto.config as unknown as Prisma.InputJsonValue;
    await this.prisma.crmViewPref.upsert({
      where: { user_email_entity: { user_email: user.email, entity } },
      create: { user_email: user.email, entity, config },
      update: { config },
    });
    return { ok: true };
  }
}
