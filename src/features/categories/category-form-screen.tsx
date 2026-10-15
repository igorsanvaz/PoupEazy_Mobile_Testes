import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View, type ViewStyle } from 'react-native';
import { z } from 'zod';

import { useCategories, useCreateCategory, useUpdateCategory } from '@/api/hooks';
import { ChoiceChips } from '@/components/choice-chips';
import { Button, ScreenContainer, TextField, ThemedText } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { getErrorMessage } from '@/utils/format';

const schema = z.object({
  name: z.string().trim().min(2, 'Informe o nome da categoria.').max(100, 'Nome muito longo.'),
  type: z.enum(['despesa_fixa', 'despesa_variavel', 'receita']),
});
type FormValues = z.infer<typeof schema>;

export default function CategoryFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const category = useCategories().data?.find((item) => item.id === id);
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const { control, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema), defaultValues: { name: '', type: 'despesa_variavel' },
  });

  useEffect(() => {
    if (category) reset({ name: category.nome, type: category.tipo });
  }, [category, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const input = { nome: values.name.trim(), tipo: values.type };
      if (id) await update.mutateAsync({ id, input });
      else await create.mutateAsync(input);
      router.back();
    } catch (error) {
      setError('root', { message: getErrorMessage(error, 'Não foi possível salvar a categoria.') });
    }
  });

  return (
    <ScreenContainer keyboardAware>
      <ThemedText variant="heading">{id ? 'Edite sua categoria.' : 'Crie uma categoria personalizada.'}</ThemedText>
      <View style={styles.form}>
        <Controller control={control} name="name" render={({ field }) => <TextField testID="category-name" label="Nome" placeholder="Ex.: Cursos" autoCapitalize="sentences" value={field.value} onBlur={field.onBlur} onChangeText={field.onChange} error={errors.name?.message} />} />
        <Controller control={control} name="type" render={({ field }) => (
          <ChoiceChips label="Tipo da categoria" value={field.value} onChange={field.onChange} choices={[
            { value: 'despesa_fixa', label: 'Despesa fixa' },
            { value: 'despesa_variavel', label: 'Despesa variável' },
            { value: 'receita', label: 'Receita' },
          ]} />
        )} />
        {errors.root?.message ? <ThemedText color={colors.danger} variant="caption">{errors.root.message}</ThemedText> : null}
        <Button title="Salvar categoria" loading={isSubmitting} onPress={() => void onSubmit()} />
        <Button title="Cancelar" variant="ghost" onPress={() => router.back()} />
      </View>
    </ScreenContainer>
  );
}

const styles = { form: { gap: spacing.lg } satisfies ViewStyle };
