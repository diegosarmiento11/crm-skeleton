import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TeamGuard } from '../common/guards/team.guard';
import { RequireArea } from '../auth/auth-context';
import { PeopleService } from './people.service';
import { PersonMatcherService } from './person-matcher.service';
import { CreatePersonDto, UpdatePersonDto } from './dto/crm.dto';
import { splitCsv } from './companies.controller';

const MAX_CSV_BYTES = 5 * 1024 * 1024;

@Controller('api/v1/crm/people')
@UseGuards(TeamGuard)
@RequireArea('crm')
export class PeopleController {
  constructor(
    private readonly people: PeopleService,
    private readonly matcher: PersonMatcherService,
  ) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('company_id') companyId?: string,
    @Query('source') source?: string,
    @Query('location') location?: string,
    @Query('cargo') cargo?: string,
    @Query('industry') industry?: string,
    @Query('contacted') contacted?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.people.list({
      q,
      companyId,
      source: splitCsv(source),
      location: splitCsv(location),
      cargo: splitCsv(cargo),
      industry: splitCsv(industry),
      contacted: contacted === 'yes' || contacted === 'no' ? contacted : undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  // Rutas fijas ANTES de `:id`.
  @Get('facets')
  facets(
    @Query('source') source?: string,
    @Query('location') location?: string,
    @Query('cargo') cargo?: string,
    @Query('industry') industry?: string,
    @Query('contacted') contacted?: string,
  ) {
    return this.people.facets({
      source: splitCsv(source),
      location: splitCsv(location),
      cargo: splitCsv(cargo),
      industry: splitCsv(industry),
      contacted: contacted === 'yes' || contacted === 'no' ? contacted : undefined,
    });
  }

  // Barrido: enlaza personas sin empresa a su Company por dominio de correo.
  @Post('match-domains')
  matchDomains() {
    return this.matcher.matchByDomain();
  }

  // Backfill: nombres en MAYÚSCULA → Title Case. Idempotente.
  @Post('format-names')
  formatNames() {
    return this.people.formatNames();
  }

  // Importa un CSV de personas (dedup por correo). Límite de tamaño y solo CSV.
  @Post('import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_CSV_BYTES } }))
  importCsv(@UploadedFile() file?: Express.Multer.File, @Query('source') source?: string) {
    if (!file) throw new BadRequestException('Archivo no recibido (campo `file`)');
    const isCsv = /\.csv$/i.test(file.originalname) || /csv|text\/plain/.test(file.mimetype);
    if (!isCsv) throw new BadRequestException('El archivo debe ser un CSV');
    return this.people.importCsv(file.buffer, source || undefined);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.people.get(id);
  }

  @Post()
  create(@Body() dto: CreatePersonDto) {
    return this.people.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePersonDto) {
    return this.people.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.people.remove(id);
  }
}
