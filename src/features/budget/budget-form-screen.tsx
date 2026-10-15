import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View, type ViewStyle } from 'react-native';
import { z } from 'zod';

import { useBudgets, useGetOrCreateBudget, useUpdateBudget } from '@/api/hooks';
import { SelectField } from '@/components/select-field';
import { Button, ScreenContainer, TextField, ThemedText } from '@/components/ui';
import { usePeriod } from '@/state/period-context';
import { colors, spacing } from '@/theme';
import { getErrorMessage, MONTH_NAMES, parseMoneyInput } from '@/utils/format';

const schema = z.object({
  month: z.string().refine((value) => Number(value) >= 1 && Number(value) <= 12, 'Selecione o mês.'),
  year: z.string().regex(/^\d{4}$/, 'Informe um ano com quatro dígitos.').refine((value) => Number(value) >= 2000 && Number(value) <= 2100, 'Ano fora do intervalo permitido.'),
  amount: z.string().refine((value) => parseMoneyInput(value) > 0, 'Informe um valor maior que zero.'),
});
type FormValues = z.infer<typeof schema>;

export default function BudgetFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { month, year } = usePeriod();
  const budgetsQuery = useBudgets();
  const ensure = useGetOrCreateBudget();
  const update = useUpdateBudget();
  const budget = budgetsQuery.data?.find((item) => item.id === id);
  const { control, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { month: String(month), year: String(year), amount: '' },
  });

  useEffect(() => {
    if (budget) reset({ month: String(budget.mes), year: String(budget.ano), amount: String(budget.valor_planejado).replace('.', ',') });
  }, [budget, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const target = budget ?? await ensure.mutateAsync({ mes: Number(values.month), ano: Number(values.year) });
      await update.mutateAsync({ id: target.id, input: { valor_planejado: parseMoneyInput(values.amount) } });
      router.back();
    } catch (error) {
      setError('root', { message: getErrorMessage(error, 'Não foi possível salvar o orçamento.') });
    }
  });

  return (
    <ScreenContainer keyboardAware>
      <ThemedText variant="heading">Defina quanto pretende gastar no mês.</ThemedText>
      <View style={styles.form}>
        <Controller control={control} name="month" render={({ field }) => (
          <SelectField
            label="Mês"
            value={field.value}
            onChange={field.onChange}
            options={MONTH_NAMES.map((label, index) => ({ label, value: String(index + 1) }))}
            error={errors.month?.message}
          />
        )} />
        <Controller control={control} name="year" render={({ field }) => (
          <TextField testID="budget-year" label="Ano" keyboardType="number-pad" maxLength={4} editable={!budget} value={field.value} onBlur={field.onBlur} onChangeText={field.onChange} error={errors.year?.message} />
        )} />
        <Controller control={control} name="amount" render={({ field }) => (
          <TextField testID="budget-amount" label="Valor planejado (R$)" placeholder="0,00" keyboardType="decimal-pad" value={field.value} onBlur={field.onBlur} onChangeText={field.onChange} error={errors.amount?.message} />
        )} />
        {errors.root?.message ? <ThemedText color={colors.danger} variant="caption">{errors.root.message}</ThemedText> : null}
        <Button title="Salvar orçamento" loading={isSubmitting} onPress={() => void onSubmit()} />
        <Button title="Cancelar" variant="ghost" onPress={() => router.back()} />
      </View>
    </ScreenContainer>
  );
}

const styles = { form: { gap: spacing.lg } satisfies ViewStyle };
