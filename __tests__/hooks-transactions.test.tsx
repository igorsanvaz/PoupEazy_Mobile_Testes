// Plano de Testes, seção 6.2 — hooks de React Query e invalidação de cache.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import {
  queryKeys,
  useCreateTransaction,
  useDeleteTransaction,
  useSyncIntegration,
  useTransactions,
  useUpdateGoal,
  useUpdateTransaction,
} from '@/api/hooks';
import { goalsService, integrationsService, transactionsService } from '@/api/services';
import type { Paginated, Transaction, TransactionInput } from '@/types/api';

// Somente a camada de rede é simulada; React Query e o cache são reais.
jest.mock('@/api/services', () => ({
  transactionsService: { list: jest.fn(), create: jest.fn(), update: jest.fn(), remove: jest.fn() },
  categoriesService: { list: jest.fn() },
  budgetsService: { list: jest.fn() },
  goalsService: { list: jest.fn(), update: jest.fn() },
  integrationsService: { list: jest.fn(), sync: jest.fn() },
}));

const transactionsMock = jest.mocked(transactionsService);
const goalsMock = jest.mocked(goalsService);
const integrationsMock = jest.mocked(integrationsService);

const transaction: Transaction = {
  id: 'transacao-1',
  id_orcamento: 'orcamento-1',
  id_categoria: 'categoria-1',
  id_metas: null,
  valor: '42.00',
  data_transacao: '2026-09-10',
  descricao: 'Farmácia',
  tipo: 'despesa',
  origem: 'manual',
  status: 'confirmada',
  nlp_metadata: null,
};

const page: Paginated<Transaction> = {
  data: [transaction],
  pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
};

const input: TransactionInput = {
  id_orcamento: 'orcamento-1',
  id_categoria: 'categoria-1',
  valor: 42,
  data_transacao: '2026-09-10',
  descricao: 'Farmácia',
  tipo: 'despesa',
};

function invalidatedKeys(spy: jest.SpyInstance) {
  return spy.mock.calls.map(([filters]) => filters?.queryKey);
}

describe('Hooks de React Query', () => {
  let queryClient: QueryClient;
  let invalidateSpy: jest.SpyInstance;

  function wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      // gcTime: Infinity evita timers de coleta pendentes (o padrão de mutações é 5 min).
      defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
    });
    invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
  });

  test('useTransactions devolve os dados do serviço e usa os filtros na chave do cache', async () => {
    transactionsMock.list.mockResolvedValue(page);
    const filters = { data_inicio: '2026-09-01', data_fim: '2026-09-30' };

    const { result } = renderHook(() => useTransactions(filters), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(page);
    expect(transactionsMock.list).toHaveBeenCalledWith(filters);
    expect(queryClient.getQueryData([...queryKeys.transactions, filters])).toEqual(page);
  });

  test('useTransactions expõe o erro do serviço', async () => {
    transactionsMock.list.mockRejectedValue(new Error('Falha de rede'));

    const { result } = renderHook(() => useTransactions(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual(new Error('Falha de rede'));
  });

  // Cada caso renderiza o hook e executa a mutação com as variáveis do seu próprio contrato.
  const mutations: [string, () => Promise<void>][] = [
    ['useCreateTransaction', async () => {
      transactionsMock.create.mockResolvedValue(transaction);
      const { result } = renderHook(() => useCreateTransaction(), { wrapper });
      await act(async () => { await result.current.mutateAsync(input); });
    }],
    ['useUpdateTransaction', async () => {
      transactionsMock.update.mockResolvedValue(transaction);
      const { result } = renderHook(() => useUpdateTransaction(), { wrapper });
      await act(async () => { await result.current.mutateAsync({ id: 'transacao-1', input: { valor: 50 } }); });
    }],
    ['useDeleteTransaction', async () => {
      transactionsMock.remove.mockResolvedValue(undefined);
      const { result } = renderHook(() => useDeleteTransaction(), { wrapper });
      await act(async () => { await result.current.mutateAsync('transacao-1'); });
    }],
  ];

  test.each(mutations)('%s invalida transações, orçamentos e metas após sucesso', async (_name, mutate) => {
    await mutate();

    expect(invalidatedKeys(invalidateSpy)).toEqual([queryKeys.transactions, queryKeys.budgets, queryKeys.goals]);
  });

  test('useCreateTransaction não invalida o cache quando a criação falha', async () => {
    transactionsMock.create.mockRejectedValue(new Error('Valor inválido'));
    const { result } = renderHook(() => useCreateTransaction(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync(input)).rejects.toThrow('Valor inválido');
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  test('useCreateTransaction faz a lista em cache ser buscada novamente', async () => {
    transactionsMock.list.mockResolvedValue(page);
    transactionsMock.create.mockResolvedValue(transaction);
    const { result } = renderHook(() => ({ list: useTransactions(), create: useCreateTransaction() }), { wrapper });
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    expect(transactionsMock.list).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.create.mutateAsync(input);
    });

    await waitFor(() => expect(transactionsMock.list).toHaveBeenCalledTimes(2));
  });

  test('useSyncIntegration invalida integrações, transações, orçamentos e metas', async () => {
    integrationsMock.sync.mockResolvedValue({
      integrationId: 'integracao-1',
      accounts: 1,
      found: 2,
      inserted: 2,
      updated: 0,
      unchanged: 0,
      budgetsCreated: 0,
      syncedAt: '2026-09-10T10:00:00Z',
    });
    const { result } = renderHook(() => useSyncIntegration(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('integracao-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(integrationsMock.sync).toHaveBeenCalledWith('integracao-1', expect.anything());
    expect(invalidatedKeys(invalidateSpy)).toEqual([
      queryKeys.integrations,
      queryKeys.transactions,
      queryKeys.budgets,
      queryKeys.goals,
    ]);
  });

  test('useUpdateGoal invalida somente as metas', async () => {
    goalsMock.update.mockResolvedValue({} as never);
    const { result } = renderHook(() => useUpdateGoal(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'meta-1', input: { status: 'concluida' } });
    });

    expect(goalsMock.update).toHaveBeenCalledWith('meta-1', { status: 'concluida' });
    expect(invalidatedKeys(invalidateSpy)).toEqual([queryKeys.goals]);
  });
});
