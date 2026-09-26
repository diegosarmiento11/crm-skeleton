import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CrmEntityType } from '@crm/shared';
import { TeamGuard } from '../common/guards/team.guard';
import { RequireArea, CurrentTeamUser, type RequestTeamUser } from '../auth/auth-context';
import { CommentsService } from '../comments/comments.service';
import {
  CreateCrmNoteDto,
  UpdateCrmNoteDto,
  CreateCrmTaskDto,
  UpdateCrmTaskDto,
} from '../comments/dto/comments.dto';

// Notas (comentarios y puntos de contacto) y tareas sobre entidades del CRM. El
// motor genérico es `CommentsService`; este controlador solo lo expone bajo /crm
// con el área del CRM, y valida que la entidad sea del CRM.
@Controller('api/v1/crm')
@UseGuards(TeamGuard)
@RequireArea('crm')
export class EngagementController {
  constructor(private readonly engagement: CommentsService) {}

  private entity(entityType: string, entityId: string) {
    return { entity_type: CrmEntityType.parse(entityType), entity_id: entityId };
  }

  @Get('notes')
  listNotes(@Query('entity_type') entityType: string, @Query('entity_id') entityId: string) {
    return this.engagement.listNotes(this.entity(entityType, entityId));
  }

  @Post('notes')
  createNote(@Body() dto: CreateCrmNoteDto, @CurrentTeamUser() user: RequestTeamUser) {
    return this.engagement.createNote(dto, { email: user.email, name: user.name });
  }

  @Patch('notes/:id')
  updateNote(@Param('id') id: string, @Body() dto: UpdateCrmNoteDto) {
    return this.engagement.updateNote(id, dto);
  }

  @Delete('notes/:id')
  deleteNote(@Param('id') id: string) {
    return this.engagement.deleteNote(id);
  }

  // Mis pendientes (o los de todo el equipo con ?all=1).
  @Get('tasks/pending')
  listPendingTasks(
    @Query('all') all: string | undefined,
    @CurrentTeamUser() user: RequestTeamUser,
  ) {
    return this.engagement.listPendingTasks(all === '1' ? undefined : user.email);
  }

  @Get('tasks')
  listTasks(@Query('entity_type') entityType: string, @Query('entity_id') entityId: string) {
    return this.engagement.listTasks(this.entity(entityType, entityId));
  }

  @Post('tasks')
  createTask(@Body() dto: CreateCrmTaskDto) {
    return this.engagement.createTask(dto);
  }

  @Patch('tasks/:id')
  updateTask(@Param('id') id: string, @Body() dto: UpdateCrmTaskDto) {
    return this.engagement.updateTask(id, dto);
  }

  @Delete('tasks/:id')
  deleteTask(@Param('id') id: string) {
    return this.engagement.deleteTask(id);
  }
}
