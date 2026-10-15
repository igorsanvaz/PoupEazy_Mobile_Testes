// Plano de Testes, seção 5.3 — casos-limite dos utilitários de formatação.
import { daysUntil, formatDate, isInDateRange, parseMoneyInput } from '@/utils/format';

describe('Casos-limite de formatação', () => {
  describe('parseMoneyInput', () => {
    test.each([
      ['R$ 1.500,90', 1500.9],
      ['R$1.500,90', 1500.9],
      ['1.234.567', 1234567],
      ['1,234,567', 1234567],
      [',5', 0.5],
      ['.5', 0.5],
      ['12,345', 12345],
      ['1.234,567', 1234.567],
      ['1,234.567', 1234.567],
      ['  2 500,00  ', 2500],
      ['-R$ 10,00', -10],
      ['0', 0],
    ])('interpreta %p como %p', (input, expected) => {
      expect(parseMoneyInput(input)).toBe(expected);
    });

    test.each(['', '   ', 'R$', ',', '-', 'abc'])('retorna NaN quando %p não contém número', (input) => {
      expect(parseMoneyInput(input)).toBeNaN();
    });
  });

  describe('datas', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2026, 7, 26, 12));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('daysUntil retorna 0 para hoje, independente do horário informado', () => {
      expect(daysUntil('2026-08-26')).toBe(0);
      expect(daysUntil('2026-08-26T23:59:59')).toBe(0);
    });

    test('daysUntil calcula intervalos longos em dias inteiros', () => {
      expect(daysUntil('2027-08-26')).toBe(365);
      expect(daysUntil('2025-08-26')).toBe(-365);
    });

    test('isInDateRange inclui exatamente o primeiro e o último dia', () => {
      expect(isInDateRange('2026-08-01', '2026-08-01', '2026-08-31')).toBe(true);
      expect(isInDateRange('2026-08-31', '2026-08-01', '2026-08-31')).toBe(true);
      expect(isInDateRange('2026-07-31', '2026-08-01', '2026-08-31')).toBe(false);
      expect(isInDateRange('2026-09-01', '2026-08-01', '2026-08-31')).toBe(false);
    });

    test('isInDateRange ignora o horário nos limites (T00:00 e T23:59)', () => {
      expect(isInDateRange('2026-08-01T00:00:00', '2026-08-01', '2026-08-31')).toBe(true);
      expect(isInDateRange('2026-08-31T23:59:59', '2026-08-01', '2026-08-31')).toBe(true);
      expect(isInDateRange('2026-09-01T00:00:00', '2026-08-01', '2026-08-31')).toBe(false);
    });

    test('formatDate aceita timestamp completo usando apenas a parte da data', () => {
      expect(formatDate('2026-08-05T23:30:00.000Z')).toBe('05/08/2026');
      expect(formatDate('2026-12-31T00:00:00-03:00')).toBe('31/12/2026');
    });

    test.each(['', 'data-invalida', '2026-08', '05/08/2026'])('formatDate devolve %p sem alteração quando malformado', (input) => {
      expect(formatDate(input)).toBe(input);
    });
  });
});
