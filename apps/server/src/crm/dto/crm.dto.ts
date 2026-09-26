import { createZodDto } from 'nestjs-zod';
import {
  CrmGoalSchema,
  CreateLeadSchema,
  UpdateLeadSchema,
  MoveLeadSchema,
  CreatePipelineStageSchema,
  UpdatePipelineStageSchema,
  ReorderStagesSchema,
  CreateCompanySchema,
  UpdateCompanySchema,
  CreatePersonSchema,
  UpdatePersonSchema,
  SaveViewPrefSchema,
} from '@crm/shared';

// Un DTO por schema del contrato. El ZodValidationPipe global valida solo:
// nada de class-validator, nada de `@Body() body: any`.
export class CrmGoalDto extends createZodDto(CrmGoalSchema) {}
export class CreateLeadDto extends createZodDto(CreateLeadSchema) {}
export class UpdateLeadDto extends createZodDto(UpdateLeadSchema) {}
export class MoveLeadDto extends createZodDto(MoveLeadSchema) {}
export class CreatePipelineStageDto extends createZodDto(CreatePipelineStageSchema) {}
export class UpdatePipelineStageDto extends createZodDto(UpdatePipelineStageSchema) {}
export class ReorderStagesDto extends createZodDto(ReorderStagesSchema) {}
export class CreateCompanyDto extends createZodDto(CreateCompanySchema) {}
export class UpdateCompanyDto extends createZodDto(UpdateCompanySchema) {}
export class CreatePersonDto extends createZodDto(CreatePersonSchema) {}
export class UpdatePersonDto extends createZodDto(UpdatePersonSchema) {}
export class SaveViewPrefDto extends createZodDto(SaveViewPrefSchema) {}
