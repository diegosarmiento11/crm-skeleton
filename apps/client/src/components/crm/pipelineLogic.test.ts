import { describe, expect, it } from 'vitest';
import type { Lead, PipelineStage } from '@crm/shared';
import { applyDrop, distinct, groupByStage, sumEstimated } from './pipelineLogic';

const NOW = '2026-09-25T00:00:00.000Z';

function stage(id: string, position: number, kind: PipelineStage['kind'] = 'OPEN'): PipelineStage {
  return { id, name: id, color: 'slate', position, kind, created_at: NOW, updated_at: NOW };
}

function lead(id: string, stage_id: string, position: number, estimated_value: number | null = null): Lead {
  return {
    id,
    company: id,
    stage_id,
    position,
    target_service: null,
    sector: null,
    source: null,
    estimated_value,
    owner: null,
    company_id: null,
    stage_changed_at: NOW,
    persons: [],
    person_ids: [],
    created_at: NOW,
    updated_at: NOW,
  };
}

const stages = [stage('a', 0), stage('b', 1), stage('lost', 2, 'LOST')];

describe('groupByStage', () => {
  it('crea una entrada por etapa aunque esté vacía y ordena por position', () => {
    const board = groupByStage([lead('l2', 'a', 2), lead('l1', 'a', 1)], stages);
    expect(Object.keys(board)).toEqual(['a', 'b', 'lost']);
    expect(board.a.map((l) => l.id)).toEqual(['l1', 'l2']);
    expect(board.b).toEqual([]);
  });

  it('conserva leads cuya etapa ya no existe (no se pierden en silencio)', () => {
    const board = groupByStage([lead('x', 'ghost', 0)], stages);
    expect(board.ghost.map((l) => l.id)).toEqual(['x']);
  });
});

describe('applyDrop', () => {
  const board = groupByStage([lead('l1', 'a', 0), lead('l2', 'a', 1), lead('l3', 'b', 0)], stages);

  it('soltar sobre una columna vacía agrega al final y cambia stage_id', () => {
    const r = applyDrop(board, 'l1', 'lost');
    expect(r).not.toBeNull();
    expect(r!.sourceStage).toBe('a');
    expect(r!.targetStage).toBe('lost');
    expect(r!.position).toBe(0);
    expect(r!.moved.stage_id).toBe('lost');
    expect(r!.board.a.map((l) => l.id)).toEqual(['l2']);
    expect(r!.board.lost.map((l) => l.id)).toEqual(['l1']);
  });

  it('soltar sobre otra tarjeta inserta en su lugar', () => {
    const r = applyDrop(board, 'l1', 'l3');
    expect(r!.targetStage).toBe('b');
    expect(r!.position).toBe(0);
    expect(r!.board.b.map((l) => l.id)).toEqual(['l1', 'l3']);
  });

  it('reordena dentro de la misma columna sin duplicar', () => {
    const r = applyDrop(board, 'l2', 'l1');
    expect(r!.sourceStage).toBe('a');
    expect(r!.targetStage).toBe('a');
    expect(r!.board.a.map((l) => l.id)).toEqual(['l2', 'l1']);
    expect(r!.position).toBe(0);
  });

  it('devuelve null si el destino no existe', () => {
    expect(applyDrop(board, 'l1', 'nope')).toBeNull();
    expect(applyDrop(board, 'nope', 'a')).toBeNull();
  });

  it('no muta el tablero original', () => {
    const before = JSON.stringify(board);
    applyDrop(board, 'l1', 'b');
    expect(JSON.stringify(board)).toBe(before);
  });
});

describe('helpers', () => {
  it('sumEstimated trata los nulos como 0', () => {
    expect(sumEstimated([lead('a', 'a', 0, 100), lead('b', 'a', 1, null), lead('c', 'a', 2, 50)])).toBe(150);
  });

  it('distinct recorta, deduplica y ordena', () => {
    expect(distinct([' Salud', 'Retail', null, 'Salud', '', undefined])).toEqual(['Retail', 'Salud']);
  });
});
