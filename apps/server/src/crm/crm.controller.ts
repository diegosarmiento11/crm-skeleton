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
import { TeamGuard } from '../common/guards/team.guard';
import { RequireArea, RequireRole } from '../auth/auth-context';
import { CrmService } from './crm.service';
import {
  CrmGoalDto,
  CreateLeadDto,
  UpdateLeadDto,
  MoveLeadDto,
  CreatePipelineStageDto,
  UpdatePipelineStageDto,
  ReorderStagesDto,
} from './dto/crm.dto';

/** Parsea `from`/`to` (ISO) a un rango; undefined si no vienen o no son fechas. */
function parseRange(from?: string, to?: string): { from?: Date; to?: Date } | undefined {
  const valid = (s?: string) => {
    if (!s) return undefined;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? undefined : d;
  };
  const range = { from: valid(from), to: valid(to) };
  return range.from || range.to ? range : undefined;
}

// Guard y área a nivel de CLASE: ningún método queda sin ellos por olvido.
@Controller('api/v1/crm')
@UseGuards(TeamGuard)
@RequireArea('crm')
export class CrmController {
  constructor(private readonly crm: CrmService) {}

  // ── Analítica: lectura de dirección, no operación diaria ──
  @Get('pipeline/analytics')
  @RequireRole('GERENTE')
  pipelineAnalytics(@Query('from') from?: string, @Query('to') to?: string) {
    return this.crm.pipelineAnalytics(parseRange(from, to));
  }

  @Get('pipeline/performance')
  @RequireRole('GERENTE')
  pipelinePerformance(@Query('from') from?: string, @Query('to') to?: string) {
    return this.crm.pipelinePerformance(parseRange(from, to));
  }

  @Get('insights')
  @RequireRole('GERENTE')
  crmInsights() {
    return this.crm.crmInsights();
  }

  // ── Meta mensual (equipo) ──
  @Get('settings/goal')
  getGoal() {
    return this.crm.getGoal();
  }

  @Patch('settings/goal')
  @RequireRole('GERENTE')
  setGoal(@Body() dto: CrmGoalDto) {
    return this.crm.setGoal({ monthly_goal: dto.monthly_goal });
  }

  // ── Etapas ──
  @Get('stages')
  listStages() {
    return this.crm.listStages();
  }

  @Post('stages')
  @RequireRole('GERENTE')
  createStage(@Body() dto: CreatePipelineStageDto) {
    return this.crm.createStage(dto);
  }

  // `reorder` va ANTES de `:id`: si no, Nest lo tomaría como un id.
  @Patch('stages/reorder')
  @RequireRole('GERENTE')
  reorderStages(@Body() dto: ReorderStagesDto) {
    return this.crm.reorderStages(dto);
  }

  @Patch('stages/:id')
  @RequireRole('GERENTE')
  updateStage(@Param('id') id: string, @Body() dto: UpdatePipelineStageDto) {
    return this.crm.updateStage(id, dto);
  }

  @Delete('stages/:id')
  @RequireRole('GERENTE')
  deleteStage(@Param('id') id: string) {
    return this.crm.deleteStage(id);
  }

  // ── Leads ──
  @Get('leads')
  listLeads(
    @Query('stage_id') stageId?: string,
    @Query('owner') owner?: string,
    @Query('q') q?: string,
  ) {
    return this.crm.listLeads({ stageId, owner, q });
  }

  @Get('leads/:id')
  getLead(@Param('id') id: string) {
    return this.crm.getLead(id);
  }

  @Get('leads/:id/stage-history')
  leadStageHistory(@Param('id') id: string) {
    return this.crm.leadStageHistory(id);
  }

  @Post('leads')
  createLead(@Body() dto: CreateLeadDto) {
    return this.crm.createLead(dto);
  }

  @Patch('leads/:id/move')
  moveLead(@Param('id') id: string, @Body() dto: MoveLeadDto) {
    return this.crm.moveLead(id, dto);
  }

  @Patch('leads/:id')
  updateLead(@Param('id') id: string, @Body() dto: UpdateLeadDto) {
    return this.crm.updateLead(id, dto);
  }

  @Delete('leads/:id')
  deleteLead(@Param('id') id: string) {
    return this.crm.deleteLead(id);
  }
}
