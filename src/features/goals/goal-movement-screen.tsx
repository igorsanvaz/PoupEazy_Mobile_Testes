import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { View, type ViewStyle } from 'react-native';
import { z } from 'zod';

import { useCategories, useCreateTransaction, useGetOrCreateBudget, useGoals } from '@/api/hooks';
import { ChoiceChips } from '@/components/choice-chips';
import { SelectField } from '@/components/select-field';
import { Button, ScreenContainer, TextField, ThemedText } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { getErrorMessage, parseMoneyInput, todayDateOnly } from '@/utils/format';

const schema = z.object({
  type: z.enum(['despesa', 'receita']),
  amount: z.string().refine((value) => parseMoneyInput(value) > 0, 'Informe um valor maior que zero.'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD.'),
  description: z.string().trim().max(255, 'Descrição muito longa.'),
  categoryId: z.string().min(1, 'Selecione uma categoria.'),
});
type FormValues = z.infer<typeof schema>;

export default function GoalMovementScreen() {
  const { goalId } = useLocalSearchParams<{ goalId?: string }>();
  const goal = useGoals().data?.find((item) => item.id === goalId);
  const categoriesQuery = useCategories();
  const ensureBudget = useGetOrCreateBudget();
  const createTransaction = useCreateTransaction();
  const { control, handleSubmit, setValue, setError, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'despesa', amount: '', date: todayDateOnly(), description: '', categoryId: '' },
  });
  const type = useWatch({ control, name: 'type' });
  const categoryId = useWatch({ control, name: 'categoryId' });
  const categories = (categoriesQuery.data ?? []).filter((item) => type === 'receita' ? item.tipo === 'receita' : item.tipo !== 'receita');

  useEffect(() => {
    if (categoryId && !categories.some((item) => item.id === categoryId)) setValue('categoryId', '');
  }, [categories, categoryId, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (!goalId || !goal) throw new Error('Meta não encontrada.');
      const [year, month] = values.date.split('-').map(Number);
      const budget = await ensureBudget.mutateAsync({ mes: month, ano: year });
      await createTransaction.mutateAsync({
        id_orcamento: budget.id,
        id_metas: goalId,
        id_categoria: values.categoryId,
        valor: parseMoneyInput(values.amount),
        data_transacao: values.date,
        descricao: values.description.trim() || (values.type === 'despesa' ? 'Aporte na meta' : 'Retirada da meta'),
        tipo: values.type,
        origem: 'manual',
        status: 'confirmada',
        nlp_metadata: null,
      });
      router.back();
    } catch (error) {
      setError('root', { message: getErrorMessage(error, 'Não foi possível registrar a movimentação.') });
    }
  });

  return (
    <ScreenContainer keyboardAware>
      <ThemedText variant="heading">{goal?.nome ?? 'Meta'}</ThemedText>
      <ThemedText color={colors.textMuted}>Aporte aumenta o progresso; retirada reduz o valor guardado.</ThemedText>
      <Controller control={control} name="type" render={({ field }) => (
        <ChoiceChips label="Tipo de movimentação" value={field.value} onChange={field.onChange} choices={[{ value: 'despesa', label: 'Aporte' }, { value: 'receita', label: 'Retirada' }]} />
      )} />
      <View style={styles.form}>
        <Controller control={control} name="amount" render={({ field }) => <TextField testID="goal-movement-amount" label="Valor (R$)" placeholder="0,00" keyboardType="decimal-pad" value={field.value} onBlur={field.onBlur} onChangeText={field.onChange} error={errors.amount?.message} />} />
        <Controller control={control} name="date" render={({ field }) => <TextField testID="goal-movement-date" label="Data" placeholder="AAAA-MM-DD" keyboardType="numbers-and-punctuation" value={field.value} onBlur={field.onBlur} onChangeText={field.onChange} error={errors.date?.message} />} />
        <Controller control={control} name="description" render={({ field }) => <TextField testID="goal-movement-description" label="Descrição (opcional)" autoCapitalize="sentences" value={field.value} onBlur={field.onBlur} onChangeText={field.onChange} error={errors.description?.message} />} />
        <Controller control={control} name="categoryId" render={({ field }) => <SelectField label="Categoria" value={field.value} onChange={field.onChange} options={categories.map((item) => ({ label: item.nome, value: item.id }))} error={errors.categoryId?.message} />} />
        {errors.root?.message ? <ThemedText color={colors.danger} variant="caption">{errors.root.message}</ThemedText> : null}
        <Button title="Confirmar movimentação" loading={isSubmitting} onPress={() => void onSubmit()} />
        <Button title="Cancelar" variant="ghost" onPress={() => router.back()} />
      </View>
    </ScreenContainer>
  );
}

const styles = { form: { gap: spacing.lg } satisfies ViewStyle };
