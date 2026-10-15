import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View, type ViewStyle } from 'react-native';
import { z } from 'zod';

import { useCreateGoal, useGoals, useUpdateGoal } from '@/api/hooks';
import { Button, LoadingState, ScreenContainer, TextField, ThemedText } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { getErrorMessage, parseMoneyInput } from '@/utils/format';

const schema = z.object({
  name: z.string().trim().min(2, 'Informe o nome da meta.').max(100, 'Nome muito longo.'),
  description: z.string().trim().max(2000, 'Descrição muito longa.'),
  target: z.string().refine((value) => parseMoneyInput(value) > 0, 'Informe um objetivo maior que zero.'),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD.'),
});
type FormValues = z.infer<typeof schema>;

export default function GoalFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const goalsQuery = useGoals();
  const goal = goalsQuery.data?.find((item) => item.id === id);
  const create = useCreateGoal();
  const update = useUpdateGoal();
  const { control, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema), defaultValues: { name: '', description: '', target: '', deadline: '' },
  });

  useEffect(() => {
    if (goal) reset({ name: goal.nome, description: goal.descricao ?? '', target: String(goal.valor_objetivo).replace('.', ','), deadline: goal.data_limite.slice(0, 10) });
  }, [goal, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const input = { nome: values.name.trim(), descricao: values.description.trim() || null, valor_objetivo: parseMoneyInput(values.target), data_limite: values.deadline };
      if (id) await update.mutateAsync({ id, input });
      else await create.mutateAsync(input);
      router.back();
    } catch (error) {
      setError('root', { message: getErrorMessage(error, 'Não foi possível salvar a meta.') });
    }
  });

  if (id && goalsQuery.isLoading) return <LoadingState message="Abrindo meta…" />;

  return (
    <ScreenContainer keyboardAware>
      <ThemedText variant="heading">{id ? 'Atualize sua meta.' : 'Qual é a sua próxima conquista?'}</ThemedText>
      <View style={styles.form}>
        <Controller control={control} name="name" render={({ field }) => <TextField testID="goal-name" label="Nome da meta" placeholder="Ex.: Viagem em família" autoCapitalize="sentences" value={field.value} onBlur={field.onBlur} onChangeText={field.onChange} error={errors.name?.message} />} />
        <Controller control={control} name="description" render={({ field }) => <TextField testID="goal-description" label="Descrição (opcional)" multiline numberOfLines={3} textAlignVertical="top" autoCapitalize="sentences" value={field.value} onBlur={field.onBlur} onChangeText={field.onChange} error={errors.description?.message} />} />
        <Controller control={control} name="target" render={({ field }) => <TextField testID="goal-target" label="Valor objetivo (R$)" placeholder="0,00" keyboardType="decimal-pad" value={field.value} onBlur={field.onBlur} onChangeText={field.onChange} error={errors.target?.message} />} />
        <Controller control={control} name="deadline" render={({ field }) => <TextField testID="goal-deadline" label="Data limite" placeholder="AAAA-MM-DD" keyboardType="numbers-and-punctuation" helperText="Use o formato AAAA-MM-DD" value={field.value} onBlur={field.onBlur} onChangeText={field.onChange} error={errors.deadline?.message} />} />
        {errors.root?.message ? <ThemedText color={colors.danger} variant="caption">{errors.root.message}</ThemedText> : null}
        <Button title={id ? 'Salvar alterações' : 'Criar meta'} loading={isSubmitting} onPress={() => void onSubmit()} />
        <Button title="Cancelar" variant="ghost" onPress={() => router.back()} />
      </View>
    </ScreenContainer>
  );
}

const styles = { form: { gap: spacing.lg } satisfies ViewStyle };
