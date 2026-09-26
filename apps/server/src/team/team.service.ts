import { Injectable, NotFoundException } from '@nestjs/common';
import type { UpdateTeamMemberInput } from '@crm/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TeamService {
  constructor(private readonly prisma: PrismaService) {}

  /** Directorio: lo lee cualquier autenticado (selectores de responsable, menciones). */
  async listMembers() {
    const items = await this.prisma.teamUser.findMany({
      orderBy: [{ is_active: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        is_active: true,
        last_login_at: true,
      },
    });
    return { items };
  }

  async updateMember(id: string, data: UpdateTeamMemberInput) {
    const row = await this.prisma.teamUser.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Miembro no encontrado');
    return this.prisma.teamUser.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        is_active: true,
        last_login_at: true,
      },
    });
  }
}
