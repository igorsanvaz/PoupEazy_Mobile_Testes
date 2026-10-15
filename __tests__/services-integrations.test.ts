// Plano de Testes, seção 5.4 — serviços de integração / Open Finance (Pluggy).
jest.mock('@/api/client', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

import { api } from '@/api/client';
import { integrationsService, transactionsService } from '@/api/services';
import type { Integration } from '@/types/api';

const getMock = jest.mocked(api.get);
const postMock = jest.mocked(api.post);
const deleteMock = jest.mocked(api.delete);

const integration: Integration = {
  id: 'integracao-1',
  instituicao: 'Pluggy Bank',
  expira_em: '2027-01-01T00:00:00Z',
  ultimo_uso: null,
  ativo: true,
  criado_em: '2026-09-01T12:00:00Z',
};

describe('Serviços de integração / Open Finance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('list busca as integrações em GET /integracoes', async () => {
    getMock.mockResolvedValue([integration]);

    await expect(integrationsService.list()).resolves.toEqual([integration]);

    expect(getMock).toHaveBeenCalledWith('/integracoes');
  });

  test('connectToken pede o token do widget em GET /pluggy/token', async () => {
    getMock.mockResolvedValue({ connectToken: 'connect-token' });

    await expect(integrationsService.connectToken()).resolves.toEqual({ connectToken: 'connect-token' });

    expect(getMock).toHaveBeenCalledWith('/pluggy/token');
  });

  test('connect registra a instituição e o item em POST /integracoes', async () => {
    postMock.mockResolvedValue(integration);

    await expect(integrationsService.connect('Pluggy Bank', 'item-123')).resolves.toBe(integration);

    expect(postMock).toHaveBeenCalledWith('/integracoes', { instituicao: 'Pluggy Bank', itemId: 'item-123' });
  });

  test('disconnect remove a integração em DELETE /integracoes/<id>', async () => {
    deleteMock.mockResolvedValue(undefined);

    await integrationsService.disconnect('integracao-1');

    expect(deleteMock).toHaveBeenCalledWith('/integracoes/integracao-1');
  });

  test('sync devolve o resumo da sincronização', async () => {
    const result = {
      integrationId: 'integracao-1',
      accounts: 1,
      found: 3,
      inserted: 2,
      updated: 1,
      unchanged: 0,
      budgetsCreated: 0,
      syncedAt: '2026-09-01T12:00:00Z',
    };
    postMock.mockResolvedValue(result);

    await expect(integrationsService.sync('integracao-1')).resolves.toBe(result);

    expect(postMock).toHaveBeenCalledWith('/pluggy/sync/integracao-1');
  });

  // queryString é privado; é exercitado pelo único serviço que o usa.
  describe('queryString (via transactionsService.list)', () => {
    beforeEach(() => {
      getMock.mockResolvedValue([]);
    });

    test('sem filtros não acrescenta "?" à URL', async () => {
      await transactionsService.list({});

      expect(getMock).toHaveBeenCalledWith('/despesas');
    });

    test('omite undefined, null e string vazia', async () => {
      await transactionsService.list({
        q: undefined,
        id_categoria: null as unknown as string,
        id_metas: '',
        tipo: 'receita',
      });

      expect(getMock).toHaveBeenCalledWith('/despesas?tipo=receita');
    });

    test('mantém o zero e codifica caracteres especiais', async () => {
      await transactionsService.list({
        q: 'café/pão 100%',
        data_inicio: '2026-09-01',
        page: 0,
      });

      expect(getMock).toHaveBeenCalledWith(
        '/despesas?q=caf%C3%A9%2Fp%C3%A3o+100%25&data_inicio=2026-09-01&page=0',
      );
    });
  });
});
