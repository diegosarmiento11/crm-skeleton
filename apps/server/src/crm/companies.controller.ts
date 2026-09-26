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
import { RequireArea } from '../auth/auth-context';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/crm.dto';

/** Filtros multi-valor llegan separados por coma (`industry=a,b`). */
export function splitCsv(v?: string): string[] | undefined {
  if (!v) return undefined;
  const parts = v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : undefined;
}

@Controller('api/v1/crm/companies')
@UseGuards(TeamGuard)
@RequireArea('crm')
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('industry') industry?: string,
    @Query('city') city?: string,
    @Query('source') source?: string,
    @Query('domain') domain?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.companies.list({
      q,
      industry: splitCsv(industry),
      city: splitCsv(city),
      source: splitCsv(source),
      domain: splitCsv(domain),
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  // `facets` va ANTES de `:id`.
  @Get('facets')
  facets() {
    return this.companies.facets();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.companies.get(id);
  }

  @Post()
  create(@Body() dto: CreateCompanyDto) {
    return this.companies.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCompanyDto) {
    return this.companies.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.companies.remove(id);
  }
}
