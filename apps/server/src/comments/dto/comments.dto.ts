import { createZodDto } from 'nestjs-zod';
import {
  CreateCrmNoteSchema,
  UpdateCrmNoteSchema,
  CreateCrmTaskSchema,
  UpdateCrmTaskSchema,
} from '@crm/shared';

export class CreateCrmNoteDto extends createZodDto(CreateCrmNoteSchema) {}
export class UpdateCrmNoteDto extends createZodDto(UpdateCrmNoteSchema) {}
export class CreateCrmTaskDto extends createZodDto(CreateCrmTaskSchema) {}
export class UpdateCrmTaskDto extends createZodDto(UpdateCrmTaskSchema) {}
