import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { UpdateTeamMemberSchema } from '@crm/shared';
import { TeamGuard } from '../common/guards/team.guard';
import { RequireArea, RequireRole } from '../auth/auth-context';
import { TeamService } from './team.service';

export class UpdateTeamMemberDto extends createZodDto(UpdateTeamMemberSchema) {}

@Controller('api/v1/team')
@UseGuards(TeamGuard)
export class TeamController {
  constructor(private readonly team: TeamService) {}

  // Directorio legible por CUALQUIER rol con acceso al CRM (los selectores de
  // responsable lo necesitan). Por eso el área va aquí, por método, y no en la clase.
  @Get('members')
  @RequireArea('crm')
  members() {
    return this.team.listMembers();
  }

  // Administrar el equipo (rol, activar/desactivar) es de Gerencia.
  @Patch('members/:id')
  @RequireArea('equipo')
  @RequireRole('GERENTE')
  update(@Param('id') id: string, @Body() dto: UpdateTeamMemberDto) {
    return this.team.updateMember(id, dto);
  }
}
