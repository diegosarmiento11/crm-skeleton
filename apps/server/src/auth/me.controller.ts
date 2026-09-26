import { Controller, Get, UseGuards } from '@nestjs/common';
import { ROLE_AREAS, type TeamMe } from '@crm/shared';
import { TeamGuard } from '../common/guards/team.guard';
import { CurrentTeamUser, type RequestTeamUser } from './auth-context';

// Quién soy. Sin @RequireArea a propósito: es el único endpoint que un PENDIENTE
// puede llamar, para que el cliente le muestre "tu cuenta espera un rol".
@Controller('api/v1/me')
@UseGuards(TeamGuard)
export class MeController {
  @Get()
  me(@CurrentTeamUser() user: RequestTeamUser): TeamMe {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      areas: [...ROLE_AREAS[user.role]],
      ...(user.impersonatorRole ? { impersonator_role: user.impersonatorRole } : {}),
    };
  }
}
