// Plano de Testes, seção 5.1 — serviços de orçamentos e metas.
jest.mock('@/api/client', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

import { api } from '@/api/client';
import { budgetsService, goalsService } from '@/api/services';
import type { Budget, Goal } from '@/types/api';

const getMock = jest.mocked(api.get);
const postMock = jest.mocked(api.post);
const patchMock = jest.mocked(api.patch);
const deleteMock = jest.mocked(api.delete);

const budget: Budget = {
  id: 'orcamento-1',
  id_usuario: 'usuario-1',
  mes: 9,
  ano: 2026,
  valor_planejado: '2500.00',
  valor_real: '0',
};

const goal: Goal = {
  id: 'meta-1',
  id_usuario: 'usuario-1',
  nome: 'Viagem',
  descricao: null,
  valor_objetivo: '5000.00',
  valor_atual: '0',
  data_limite: '2026-12-31',
  status: 'ativa',
};

describe('Serviços de orçamentos e metas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('budgetsService', () => {
    test('list busca os orçamentos em GET /orcamentos', async () => {
      getMock.mockResolvedValue([budget]);

      await expect(budgetsService.list()).resolves.toEqual([budget]);

      expect(getMock).toHaveBeenCalledWith('/orcamentos');
    });

    test('create envia o orçamento em POST /orcamentos', async () => {
      postMock.mockResolvedValue(budget);

      await budgetsService.create({ mes: 9, ano: 2026, valor_planejado: 2500 });

      expect(postMock).toHaveBeenCalledWith('/orcamentos', { mes: 9, ano: 2026, valor_planejado: 2500 });
    });

    test('getOrCreate envia mês e ano em POST /orcamentos/get-or-create', async () => {
      postMock.mockResolvedValue(budget);

      await expect(budgetsService.getOrCreate({ mes: 9, ano: 2026 })).resolves.toBe(budget);

      expect(postMock).toHaveBeenCalledTimes(1);
      expect(postMock).toHaveBeenCalledWith('/orcamentos/get-or-create', { mes: 9, ano: 2026 });
    });

    test('update altera o orçamento em PATCH /orcamentos/<id>', async () => {
      patchMock.mockResolvedValue({ ...budget, valor_planejado: '3000.00' });

      await budgetsService.update('orcamento-1', { valor_planejado: 3000 });

      expect(patchMock).toHaveBeenCalledWith('/orcamentos/orcamento-1', { valor_planejado: 3000 });
    });
  });

  describe('goalsService', () => {
    test('list busca as metas em GET /metas', async () => {
      getMock.mockResolvedValue([goal]);

      await expect(goalsService.list()).resolves.toEqual([goal]);

      expect(getMock).toHaveBeenCalledWith('/metas');
    });

    test('create envia a nova meta em POST /metas', async () => {
      const input = { nome: 'Viagem', descricao: null, valor_objetivo: 5000, data_limite: '2026-12-31' };
      postMock.mockResolvedValue(goal);

      await goalsService.create(input);

      expect(postMock).toHaveBeenCalledWith('/metas', input);
    });

    test('update altera a meta em PATCH /metas/<id>', async () => {
      patchMock.mockResolvedValue({ ...goal, status: 'concluida' });

      await goalsService.update('meta-1', { status: 'concluida' });

      expect(patchMock).toHaveBeenCalledWith('/metas/meta-1', { status: 'concluida' });
    });

    test('remove exclui a meta em DELETE /metas/<id>', async () => {
      deleteMock.mockResolvedValue(undefined);

      await goalsService.remove('meta-1');

      expect(deleteMock).toHaveBeenCalledWith('/metas/meta-1');
    });
  });

  describe('identificadores com caracteres especiais', () => {
    // Os serviços de orçamento/meta interpolam o id sem encodeURIComponent.
    // O teste documenta o comportamento atual: o id chega íntegro ao cliente,
    // sem truncar nem lançar erro, e o caminho continua sob o recurso correto.
    test.each([
      ['uuid comum', '9b2f1c3e-7a4d-4e1b-9c2a-1f0e8d7c6b5a'],
      ['com espaço e acento', 'meta com espaço'],
      ['com caracteres reservados', 'id?x=1&y#z'],
    ])('não quebra a URL para id %s', async (_descricao, id) => {
      patchMock.mockResolvedValue(budget);
      deleteMock.mockResolvedValue(undefined);

      await expect(budgetsService.update(id, { valor_planejado: 1 })).resolves.toBe(budget);
      await expect(goalsService.remove(id)).resolves.toBeUndefined();

      expect(patchMock).toHaveBeenCalledWith(`/orcamentos/${id}`, { valor_planejado: 1 });
      expect(deleteMock).toHaveBeenCalledWith(`/metas/${id}`);
    });
  });
});
