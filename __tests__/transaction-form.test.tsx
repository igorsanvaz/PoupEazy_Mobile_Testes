// Plano de Testes, seção 6.3 — validação do formulário de transação (Zod + react-hook-form).
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import {
  useCategories,
  useCreateTransaction,
  useGetOrCreateBudget,
  useTransactions,
  useUpdateTransaction,
} from '@/api/hooks';
import TransactionFormScreen from '@/features/transactions/transaction-form-screen';
import type { Category, Transaction } from '@/types/api';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));

// O formulário, o schema Zod e os componentes são reais; só os hooks de dados são simulados.
jest.mock('@/api/hooks', () => ({
  useCategories: jest.fn(),
  useCreateTransaction: jest.fn(),
  useGetOrCreateBudget: jest.fn(),
  useTransactions: jest.fn(),
  useUpdateTransaction: jest.fn(),
}));

const categories: Category[] = [
  { id: 'cat-mercado', id_usuario: null, nome: 'Mercado', tipo: 'despesa_variavel', icone: null, sistema: true },
  { id: 'cat-aluguel', id_usuario: null, nome: 'Aluguel', tipo: 'despesa_fixa', icone: null, sistema: true },
  { id: 'cat-salario', id_usuario: null, nome: 'Salário', tipo: 'receita', icone: null, sistema: true },
  { id: 'cat-freela', id_usuario: 'usuario-1', nome: 'Freela', tipo: 'receita', icone: null, sistema: false },
];

const existing: Transaction = {
  id: 'transacao-1',
  id_orcamento: 'orcamento-set',
  id_categoria: 'cat-mercado',
  id_metas: null,
  valor: '89.90',
  data_transacao: '2026-09-15T00:00:00Z',
  descricao: 'Compra do mês',
  tipo: 'despesa',
  origem: 'manual',
  status: 'confirmada',
  nlp_metadata: null,
};

const create = jest.fn();
const update = jest.fn();
const ensureBudget = jest.fn();

function setup({ id, transactions = [] }: { id?: string; transactions?: Transaction[] } = {}) {
  jest.mocked(useLocalSearchParams).mockReturnValue(id ? { id } : {});
  jest.mocked(useTransactions).mockReturnValue({ data: { data: transactions }, isLoading: false } as never);
  jest.mocked(useCategories).mockReturnValue({ data: categories } as never);
  jest.mocked(useCreateTransaction).mockReturnValue({ mutateAsync: create } as never);
  jest.mocked(useUpdateTransaction).mockReturnValue({ mutateAsync: update } as never);
  jest.mocked(useGetOrCreateBudget).mockReturnValue({ mutateAsync: ensureBudget } as never);
  return render(<TransactionFormScreen />);
}

function selectCategory(name: string) {
  fireEvent.press(screen.getByLabelText(/^Categoria: /));
  fireEvent.press(screen.getByRole('radio', { name }));
}

function fillValidExpense() {
  fireEvent.changeText(screen.getByLabelText('Descrição'), '  Supermercado  ');
  fireEvent.changeText(screen.getByLabelText('Valor (R$)'), '1.234,56');
  selectCategory('Mercado');
  fireEvent.changeText(screen.getByLabelText('Data'), '2026-09-20');
}

// O primeiro render carrega toda a árvore de UI e pode passar dos 5 s padrão em máquinas lentas/CI.
jest.setTimeout(30_000);

describe('Formulário de transação', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ensureBudget.mockResolvedValue({ id: 'orcamento-set' });
    create.mockResolvedValue({});
    update.mockResolvedValue({});
  });

  afterEach(cleanup);

  test('submeter vazio mostra as mensagens de validação e não chama a API', async () => {
    setup();

    fireEvent.press(screen.getByRole('button', { name: 'Criar transação' }));

    expect(await screen.findByText('Informe uma descrição.')).toBeTruthy();
    expect(screen.getByText('Informe um valor maior que zero.')).toBeTruthy();
    expect(screen.getByText('Selecione uma categoria.')).toBeTruthy();
    expect(ensureBudget).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(router.back).not.toHaveBeenCalled();
  });

  test.each(['0,00', '0', '-10,00', 'abc'])('valor %p é barrado (precisa ser maior que zero)', async (amount) => {
    setup();
    fillValidExpense();
    fireEvent.changeText(screen.getByLabelText('Valor (R$)'), amount);

    fireEvent.press(screen.getByRole('button', { name: 'Criar transação' }));

    expect(await screen.findByText('Informe um valor maior que zero.')).toBeTruthy();
    expect(create).not.toHaveBeenCalled();
  });

  test.each(['20/09/2026', '2026-9-20', '2026/09/20', ''])('data %p mostra "Use o formato AAAA-MM-DD."', async (date) => {
    setup();
    fillValidExpense();
    fireEvent.changeText(screen.getByLabelText('Data'), date);

    fireEvent.press(screen.getByRole('button', { name: 'Criar transação' }));

    expect(await screen.findByText('Use o formato AAAA-MM-DD.')).toBeTruthy();
    expect(create).not.toHaveBeenCalled();
  });

  test('dados válidos garantem o orçamento do mês, criam a transação e voltam', async () => {
    setup();
    fillValidExpense();

    fireEvent.press(screen.getByRole('button', { name: 'Criar transação' }));

    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(ensureBudget).toHaveBeenCalledWith({ mes: 9, ano: 2026 });
    expect(create).toHaveBeenCalledWith({
      id_orcamento: 'orcamento-set',
      id_categoria: 'cat-mercado',
      id_metas: null,
      valor: 1234.56,
      data_transacao: '2026-09-20',
      descricao: 'Supermercado',
      tipo: 'despesa',
      origem: 'manual',
      status: 'confirmada',
      nlp_metadata: null,
    });
    expect(update).not.toHaveBeenCalled();
  });

  test('erro da API aparece no formulário e não fecha a tela', async () => {
    create.mockRejectedValueOnce(new Error('Orçamento indisponível.'));
    setup();
    fillValidExpense();

    fireEvent.press(screen.getByRole('button', { name: 'Criar transação' }));

    expect(await screen.findByText('Orçamento indisponível.')).toBeTruthy();
    expect(router.back).not.toHaveBeenCalled();
  });

  test('trocar o tipo filtra as categorias e limpa a categoria incompatível', async () => {
    setup();

    fireEvent.press(screen.getByLabelText(/^Categoria: /));
    expect(screen.getByRole('radio', { name: 'Mercado' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Aluguel' })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Salário' })).toBeNull();
    fireEvent.press(screen.getByRole('radio', { name: 'Mercado' }));
    expect(screen.getByLabelText('Categoria: Mercado')).toBeTruthy();

    fireEvent.press(screen.getByRole('radio', { name: 'Receita' }));

    await waitFor(() => expect(screen.getByLabelText('Categoria: Selecione…')).toBeTruthy());
    fireEvent.press(screen.getByLabelText(/^Categoria: /));
    expect(screen.getByRole('radio', { name: 'Salário' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Freela' })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Mercado' })).toBeNull();
  });

  test('edição pré-preenche os campos e salva com update', async () => {
    setup({ id: 'transacao-1', transactions: [existing] });

    expect(await screen.findByDisplayValue('Compra do mês')).toBeTruthy();
    expect(screen.getByDisplayValue('89,90')).toBeTruthy();
    expect(screen.getByDisplayValue('2026-09-15')).toBeTruthy();
    expect(screen.getByLabelText('Categoria: Mercado')).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText('Valor (R$)'), '99,90');
    fireEvent.press(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(update).toHaveBeenCalledWith({
      id: 'transacao-1',
      input: expect.objectContaining({ valor: 99.9, descricao: 'Compra do mês', id_categoria: 'cat-mercado' }),
    });
    expect(create).not.toHaveBeenCalled();
  });

  test('edição de uma transação inexistente mostra aviso', () => {
    setup({ id: 'nao-existe' });

    expect(screen.getByText('Transação não encontrada.')).toBeTruthy();
  });
});
