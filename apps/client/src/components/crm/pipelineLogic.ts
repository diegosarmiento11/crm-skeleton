import type { Lead, PipelineStage } from '@crm/shared';

// Lógica pura del kanban, separada del componente para poder probarla sin DOM
// (y para que PipelineBoard.tsx exporte solo componentes: react-refresh).

export type Board = Record<string, Lead[]>;

/** Agrupa los leads por etapa, ordenados por `position`. Toda etapa existe aunque esté vacía. */
export function groupByStage(leads: Lead[], stages: PipelineStage[]): Board {
  const board: Board = {};
  for (const s of stages) board[s.id] = [];
  for (const l of leads) (board[l.stage_id] ??= []).push(l);
  for (const id of Object.keys(board)) board[id].sort((a, b) => a.position - b.position);
  return board;
}

/** Etapa que contiene al lead `id` dentro del tablero (o undefined si no está). */
export function stageOfLead(board: Board, id: string): string | undefined {
  return Object.keys(board).find((sid) => board[sid].some((l) => l.id === id));
}

export interface DropResult {
  board: Board;
  sourceStage: string;
  targetStage: string;
  /** Índice final del lead dentro de la etapa destino (lo que recibe el servidor). */
  position: number;
  moved: Lead;
}

/**
 * Aplica un "soltar" del lead `activeId` sobre `overId`, que puede ser otra
 * tarjeta (se inserta en su lugar) o una columna (se agrega al final). Devuelve
 * el tablero optimista y los datos para la mutación; `null` si no hay nada que mover.
 */
export function applyDrop(board: Board, activeId: string, overId: string): DropResult | null {
  const sourceStage = stageOfLead(board, activeId);
  const targetStage = board[overId] ? overId : stageOfLead(board, overId);
  if (!sourceStage || !targetStage) return null;

  const sourceItems = [...board[sourceStage]];
  const activeIdx = sourceItems.findIndex((l) => l.id === activeId);
  if (activeIdx === -1) return null;
  const [moved] = sourceItems.splice(activeIdx, 1);

  const targetItems = sourceStage === targetStage ? sourceItems : [...board[targetStage]];
  let position = overId === targetStage ? targetItems.length : targetItems.findIndex((l) => l.id === overId);
  if (position === -1) position = targetItems.length;
  const relocated = { ...moved, stage_id: targetStage };
  targetItems.splice(position, 0, relocated);

  return {
    board: { ...board, [sourceStage]: sourceItems, [targetStage]: targetItems },
    sourceStage,
    targetStage,
    position,
    moved: relocated,
  };
}

/** Suma del valor estimado de una columna (los nulos cuentan como 0). */
export function sumEstimated(leads: Lead[]): number {
  return leads.reduce((acc, l) => acc + (l.estimated_value ?? 0), 0);
}

/** Valores distintos, recortados y ordenados alfabéticamente (para opciones de filtro). */
export function distinct(values: (string | null | undefined)[]): string[] {
  const set = new Set<string>();
  for (const v of values) {
    const t = v?.trim();
    if (t) set.add(t);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}
