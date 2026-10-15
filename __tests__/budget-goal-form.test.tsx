// Plano de Testes, seção 6.4 — formulários de orçamento, meta e movimentação de meta.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import {
  useBudgets,
  useCategories,
  useCreateGoal,
  useCreateTransaction,
  useGetOrCreateBudget,
  useGoals,
  useUpdateBudget,
  useUpdateGoal,
} from '@/api/hooks';
import BudgetFormScreen from '@/features/budget/budget-form-screen';
import GoalFormScreen from '@/features/goals/goal-form-screen';
import GoalMovementScreen from '@/features/goals/goal-movement-screen';
import type { Budget, Category, Goal } from '@/types/api';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));

jest.mock('@/state/period-context', () => ({
  usePeriod: () => ({ month: 9, year: 2026 }),
}));

// Formulários, schemas Zod e componentes são reais; só os hooks de dados são simulados.
jest.mock('@/api/hooks', () => ({
  useBudgets: jest.fn(),
  useCategories: jest.fn(),
  useCreateGoal: jest.fn(),
  useCreateTransaction: jest.fn(),
  useGetOrCreateBudget: jest.fn(),
  useGoals: jest.fn(),
  useUpdateBudget: jest.fn(),
  useUpdateGoal: jest.fn(),
}));

// O primeiro render carrega toda a árvore de UI e pode passar dos 5 s padrão em máquinas lentas/CI.
jest.setTimeout(30_000);

const budget: Budget = {
  id: 'orcamento-set',
  id_usuario: 'usuario-1',
  mes: 9,
  ano: 2026,
  valor_planejado: '1500.50',
  valor_real: '0',
};

const goal: Goal = {
  id: 'meta-viagem',
  id_usuario: 'usuario-1',
  nome: 'Viagem em família',
  descricao: 'Férias de julho',
  valor_objetivo: '8000.00',
  valor_atual: '1200.00',
  data_limite: '2027-07-01T00:00:00Z',
  status: 'ativa',
};

const categories: Category[] = [
  { id: 'cat-investimento', id_usuario: null, nome: 'Investimentos', tipo: 'despesa_variavel', icone: null, sistema: true },
  { id: 'cat-salario', id_usuario: null, nome: 'Salário', tipo: 'receita', icone: null, sistema: true },
];

const ensureBudget = jest.fn();
const updateBudget = jest.fn();
const createGoal = jest.fn();
const updateGoal = jest.fn();
const createTransaction = jest.fn();

function arrange({ id, goalId, budgets = [], goals = [] }: {
  id?: string;
  goalId?: string;
  budgets?: Budget[];
  goals?: Goal[];
} = {}) {
  jest.mocked(useLocalSearchParams).mockReturnValue({ ...(id ? { id } : {}), ...(goalId ? { goalId } : {}) });
  jest.mocked(useBudgets).mockReturnValue({ data: budgets } as never);
  jest.mocked(useGoals).mockReturnValue({ data: goals, isLoading: false } as never);
  jest.mocked(useCategories).mockReturnValue({ data: categories } as never);
  jest.mocked(useGetOrCreateBudget).mockReturnValue({ mutateAsync: ensureBudget } as never);
  jest.mocked(useUpdateBudget).mockReturnValue({ mutateAsync: updateBudget } as never);
  jest.mocked(useCreateGoal).mockReturnValue({ mutateAsync: createGoal } as never);
  jest.mocked(useUpdateGoal).mockReturnValue({ mutateAsync: updateGoal } as never);
  jest.mocked(useCreateTransaction).mockReturnValue({ mutateAsync: createTransaction } as never);
}

function choose(label: string, option: string) {
  fireEvent.press(screen.getByLabelText(new RegExp(`^${label}: `)));
  fireEvent.press(screen.getByRole('radio', { name: option }));
}

beforeEach(() => {
  jest.clearAllMocks();
  ensureBudget.mockResolvedValue(budget);
  updateBudget.mockResolvedValue(budget);
  createGoal.mockResolvedValue(goal);
  updateGoal.mockResolvedValue(goal);
  createTransaction.mockResolvedValue({});
});

afterEach(cleanup);

describe('Formulário de orçamento', () => {
  test('começa no período selecionado e exige valor maior que zero', async () => {
    arrange();
    render(<BudgetFormScreen />);

    expect(screen.getByLabelText('Mês: Setembro')).toBeTruthy();
    expect(screen.getByDisplayValue('2026')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Salvar orçamento' }));

    expect(await screen.findByText('Informe um valor maior que zero.')).toBeTruthy();
    expect(ensureBudget).not.toHaveBeenCalled();
    expect(updateBudget).not.toHaveBeenCalled();
  });

  test.each([
    ['26', 'Informe um ano com quatro dígitos.'],
    ['1999', 'Ano fora do intervalo permitido.'],
    ['2101', 'Ano fora do intervalo permitido.'],
  ])('ano %p mostra "%s"', async (year, message) => {
    arrange();
    render(<BudgetFormScreen />);
    fireEvent.changeText(screen.getByLabelText('Ano'), year);
    fireEvent.changeText(screen.getByLabelText('Valor planejado (R$)'), '100');

    fireEvent.press(screen.getByRole('button', { name: 'Salvar orçamento' }));

    expect(await screen.findByText(message)).toBeTruthy();
    expect(ensureBudget).not.toHaveBeenCalled();
  });

  test('criação garante o orçamento do mês escolhido e grava o valor planejado', async () => {
    arrange();
    render(<BudgetFormScreen />);
    choose('Mês', 'Março');
    fireEvent.changeText(screen.getByLabelText('Valor planejado (R$)'), '2.500,00');

    fireEvent.press(screen.getByRole('button', { name: 'Salvar orçamento' }));

    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(ensureBudget).toHaveBeenCalledWith({ mes: 3, ano: 2026 });
    expect(updateBudget).toHaveBeenCalledWith({ id: 'orcamento-set', input: { valor_planejado: 2500 } });
  });

  test('edição pré-preenche, bloqueia o ano e atualiza sem criar outro orçamento', async () => {
    arrange({ id: 'orcamento-set', budgets: [budget] });
    render(<BudgetFormScreen />);

    expect(await screen.findByDisplayValue('1500,50')).toBeTruthy();
    expect(screen.getByLabelText('Ano').props.editable).toBe(false);
    fireEvent.changeText(screen.getByLabelText('Valor planejado (R$)'), '1800');
    fireEvent.press(screen.getByRole('button', { name: 'Salvar orçamento' }));

    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(ensureBudget).not.toHaveBeenCalled();
    expect(updateBudget).toHaveBeenCalledWith({ id: 'orcamento-set', input: { valor_planejado: 1800 } });
  });

  test('falha ao salvar mostra a mensagem padrão e mantém a tela aberta', async () => {
    updateBudget.mockRejectedValueOnce({ motivo: 'desconhecido' });
    arrange();
    render(<BudgetFormScreen />);
    fireEvent.changeText(screen.getByLabelText('Valor planejado (R$)'), '100');

    fireEvent.press(screen.getByRole('button', { name: 'Salvar orçamento' }));

    expect(await screen.findByText('Não foi possível salvar o orçamento.')).toBeTruthy();
    expect(router.back).not.toHaveBeenCalled();
  });
});

describe('Formulário de meta', () => {
  test('submeter vazio mostra as mensagens obrigatórias', async () => {
    arrange();
    render(<GoalFormScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'Criar meta' }));

    expect(await screen.findByText('Informe o nome da meta.')).toBeTruthy();
    expect(screen.getByText('Informe um objetivo maior que zero.')).toBeTruthy();
    expect(screen.getByText('Use o formato AAAA-MM-DD.')).toBeTruthy();
    expect(createGoal).not.toHaveBeenCalled();
  });

  test('criação envia a meta normalizada e volta', async () => {
    arrange();
    render(<GoalFormScreen />);
    fireEvent.changeText(screen.getByLabelText('Nome da meta'), '  Reserva de emergência  ');
    fireEvent.changeText(screen.getByLabelText('Descrição (opcional)'), '   ');
    fireEvent.changeText(screen.getByLabelText('Valor objetivo (R$)'), '10.000,00');
    fireEvent.changeText(screen.getByLabelText('Data limite'), '2027-12-31');

    fireEvent.press(screen.getByRole('button', { name: 'Criar meta' }));

    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(createGoal).toHaveBeenCalledWith({
      nome: 'Reserva de emergência',
      descricao: null,
      valor_objetivo: 10000,
      data_limite: '2027-12-31',
    });
    expect(updateGoal).not.toHaveBeenCalled();
  });

  test('edição pré-preenche e salva com update', async () => {
    arrange({ id: 'meta-viagem', goals: [goal] });
    render(<GoalFormScreen />);

    expect(await screen.findByDisplayValue('Viagem em família')).toBeTruthy();
    expect(screen.getByDisplayValue('Férias de julho')).toBeTruthy();
    expect(screen.getByDisplayValue('8000,00')).toBeTruthy();
    expect(screen.getByDisplayValue('2027-07-01')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Valor objetivo (R$)'), '9000');
    fireEvent.press(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(updateGoal).toHaveBeenCalledWith({
      id: 'meta-viagem',
      input: { nome: 'Viagem em família', descricao: 'Férias de julho', valor_objetivo: 9000, data_limite: '2027-07-01' },
    });
    expect(createGoal).not.toHaveBeenCalled();
  });

  test('erro da API aparece no formulário', async () => {
    createGoal.mockRejectedValueOnce(new Error('Data limite no passado.'));
    arrange();
    render(<GoalFormScreen />);
    fireEvent.changeText(screen.getByLabelText('Nome da meta'), 'Carro');
    fireEvent.changeText(screen.getByLabelText('Valor objetivo (R$)'), '30000');
    fireEvent.changeText(screen.getByLabelText('Data limite'), '2020-01-01');

    fireEvent.press(screen.getByRole('button', { name: 'Criar meta' }));

    expect(await screen.findByText('Data limite no passado.')).toBeTruthy();
    expect(router.back).not.toHaveBeenCalled();
  });
});

describe('Movimentação de meta (aporte/retirada)', () => {
  test.each(['', '0', '0,00', '-50'])('valor %p é inválido e nada é registrado', async (amount) => {
    arrange({ goalId: 'meta-viagem', goals: [goal] });
    render(<GoalMovementScreen />);
    fireEvent.changeText(screen.getByLabelText('Valor (R$)'), amount);
    choose('Categoria', 'Investimentos');

    fireEvent.press(screen.getByRole('button', { name: 'Confirmar movimentação' }));

    expect(await screen.findByText('Informe um valor maior que zero.')).toBeTruthy();
    expect(createTransaction).not.toHaveBeenCalled();
  });

  test('aporte válido cria uma despesa vinculada à meta com descrição padrão', async () => {
    arrange({ goalId: 'meta-viagem', goals: [goal] });
    render(<GoalMovementScreen />);
    expect(screen.getByText('Viagem em família')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Valor (R$)'), '250,00');
    fireEvent.changeText(screen.getByLabelText('Data'), '2026-09-05');
    choose('Categoria', 'Investimentos');

    fireEvent.press(screen.getByRole('button', { name: 'Confirmar movimentação' }));

    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(ensureBudget).toHaveBeenCalledWith({ mes: 9, ano: 2026 });
    expect(createTransaction).toHaveBeenCalledWith(expect.objectContaining({
      id_orcamento: 'orcamento-set',
      id_metas: 'meta-viagem',
      id_categoria: 'cat-investimento',
      valor: 250,
      data_transacao: '2026-09-05',
      descricao: 'Aporte na meta',
      tipo: 'despesa',
    }));
  });

  test('retirada usa categorias de receita e a descrição padrão de retirada', async () => {
    arrange({ goalId: 'meta-viagem', goals: [goal] });
    render(<GoalMovementScreen />);
    fireEvent.press(screen.getByRole('radio', { name: 'Retirada' }));
    fireEvent.changeText(screen.getByLabelText('Valor (R$)'), '100');
    fireEvent.changeText(screen.getByLabelText('Data'), '2026-10-01');

    fireEvent.press(screen.getByLabelText(/^Categoria: /));
    expect(screen.queryByRole('radio', { name: 'Investimentos' })).toBeNull();
    fireEvent.press(screen.getByRole('radio', { name: 'Salário' }));
    fireEvent.press(screen.getByRole('button', { name: 'Confirmar movimentação' }));

    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(ensureBudget).toHaveBeenCalledWith({ mes: 10, ano: 2026 });
    expect(createTransaction).toHaveBeenCalledWith(expect.objectContaining({
      id_categoria: 'cat-salario',
      descricao: 'Retirada da meta',
      tipo: 'receita',
    }));
  });

  test('meta inexistente mostra erro e não registra a movimentação', async () => {
    arrange({ goalId: 'meta-apagada', goals: [goal] });
    render(<GoalMovementScreen />);
    fireEvent.changeText(screen.getByLabelText('Valor (R$)'), '100');
    choose('Categoria', 'Investimentos');

    fireEvent.press(screen.getByRole('button', { name: 'Confirmar movimentação' }));

    expect(await screen.findByText('Meta não encontrada.')).toBeTruthy();
    expect(ensureBudget).not.toHaveBeenCalled();
    expect(createTransaction).not.toHaveBeenCalled();
    expect(router.back).not.toHaveBeenCalled();
  });
});
