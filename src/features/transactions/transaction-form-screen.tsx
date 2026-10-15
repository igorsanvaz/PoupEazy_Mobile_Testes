import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { View, type ViewStyle } from 'react-native';
import { z } from 'zod';

import {
  useCategories,
  useCreateTransaction,
  useGetOrCreateBudget,
  useTransactions,
  useUpdateTransaction,
} from '@/api/hooks';
import { ChoiceChips } from '@/components/choice-chips';
import { SelectField } from '@/components/select-field';
import { Button, LoadingState, ScreenContainer, TextField, ThemedText } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { getErrorMessage, parseMoneyInput, todayDateOnly } from '@/utils/format';

const schema = z.object({
  description: z.string().trim().min(2, 'Informe uma descrição.').max(255, 'Descrição muito longa.'),
  amount: z.string().refine((value) => parseMoneyInput(value) > 0, 'Informe um valor maior que zero.'),
  type: z.enum(['despesa', 'receita']),
  categoryId: z.string().min(1, 'Selecione uma categoria.'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD.'),
});
type FormValues = z.infer<typeof schema>;

export default function TransactionFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = Boolean(id);
  const transactionsQuery = useTransactions();
  const categoriesQuery = useCategories();
  const create = useCreateTransaction();
  const update = useUpdateTransaction();
  const ensureBudget = useGetOrCreateBudget();
  const transaction = transactionsQuery.data?.data.find((item) => item.id === id);
  const { control, handleSubmit, setValue, reset, setError, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { description: '', amount: '', type: 'despesa', categoryId: '', date: todayDateOnly() },
  });
  const type = useWatch({ control, name: 'type' });
  const categoryId = useWatch({ control, name: 'categoryId' });
  const categories = (categoriesQuery.data ?? []).filter((category) =>
    type === 'receita' ? category.tipo === 'receita' : category.tipo !== 'receita');

  useEffect(() => {
    if (!transaction) return;
    reset({
      description: transaction.descricao,
      amount: String(transaction.valor).replace('.', ','),
      type: transaction.tipo,
      categoryId: transaction.id_categoria,
      date: transaction.data_transacao.slice(0, 10),
    });
  }, [reset, transaction]);

  useEffect(() => {
    const current = categories.find((category) => category.id === categoryId);
    if (!current && categoryId) setValue('categoryId', '');
  }, [categories, categoryId, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const [year, month] = values.date.split('-').map(Number);
      const budget = await ensureBudget.mutateAsync({ mes: month, ano: year });
      const input = {
        id_orcamento: budget.id,
        id_categoria: values.categoryId,
        id_metas: transaction?.id_metas ?? null,
        valor: parseMoneyInput(values.amount),
        data_transacao: values.date,
        descricao: values.description.trim(),
        tipo: values.type,
        origem: transaction?.origem ?? 'manual' as const,
        status: transaction?.status ?? 'confirmada' as const,
        nlp_metadata: transaction?.nlp_metadata ?? null,
      };
      if (id) await update.mutateAsync({ id, input });
      else await create.mutateAsync(input);
      router.back();
    } catch (error) {
      setError('root', { message: getErrorMessage(error) });
    }
  });

  if (editing && transactionsQuery.isLoading) return <LoadingState message="Abrindo transação…" />;
  if (editing && !transaction && !transactionsQuery.isLoading) {
    return <ScreenContainer><ThemedText color={colors.danger}>Transação não encontrada.</ThemedText></ScreenContainer>;
  }

  return (
    <ScreenContainer keyboardAware>
      <ThemedText variant="heading">{editing ? 'Edite os dados da movimentação' : 'Registre uma nova movimentação'}</ThemedText>
      <Controller control={control} name="type" render={({ field }) => (
        <ChoiceChips
          label="Tipo da transação"
          value={field.value}
          onChange={field.onChange}
          choices={[{ value: 'despesa', label: 'Despesa' }, { value: 'receita', label: 'Receita' }]}
        />
      )} />
      <View style={styles.form}>
        <Controller control={control} name="description" render={({ field }) => (
          <TextField testID="transaction-description" label="Descrição" placeholder="Ex.: Supermercado" autoCapitalize="sentences" value={field.value} onBlur={field.onBlur} onChangeText={field.onChange} error={errors.description?.message} />
        )} />
        <Controller control={control} name="amount" render={({ field }) => (
          <TextField testID="transaction-amount" label="Valor (R$)" placeholder="0,00" keyboardType="decimal-pad" value={field.value} onBlur={field.onBlur} onChangeText={field.onChange} error={errors.amount?.message} />
        )} />
        <Controller control={control} name="categoryId" render={({ field }) => (
          <SelectField
            label="Categoria"
            value={field.value}
            onChange={field.onChange}
            options={categories.map((category) => ({ label: category.nome, value: category.id, detail: category.sistema ? 'Categoria PoupEazy' : 'Personalizada' }))}
            error={errors.categoryId?.message}
          />
        )} />
        <Controller control={control} name="date" render={({ field }) => (
          <TextField testID="transaction-date" label="Data" placeholder="AAAA-MM-DD" keyboardType="numbers-and-punctuation" value={field.value} onBlur={field.onBlur} onChangeText={field.onChange} helperText="Use o formato AAAA-MM-DD" error={errors.date?.message} />
        )} />
        {errors.root?.message ? <ThemedText color={colors.danger} variant="caption">{errors.root.message}</ThemedText> : null}
        <Button title={editing ? 'Salvar alterações' : 'Criar transação'} loading={isSubmitting} onPress={() => void onSubmit()} />
        <Button title="Cancelar" variant="ghost" onPress={() => router.back()} />
      </View>
    </ScreenContainer>
  );
}

const styles = { form: { gap: spacing.lg } satisfies ViewStyle };
