// Converte valores diversos (number|string|Decimal-like) para CENTAVOS (number)
export const toCents = (v: unknown): number => {
  if (v === null || v === undefined) return 0;
  // usa toString() se existir, mas SEM 'in'
  const s = (v as any)?.toString?.() ?? String(v);
  if (s.trim() === '') return 0;

  // tenta número
  const num = Number(s.replace(',', '.')); // tolera vírgula decimal
  if (!Number.isFinite(num)) return 0;

  // Heurística:
  // - se há separador decimal → assumimos REAIS e convertemos p/ centavos
  // - se não há separador → assumimos que já está em CENTAVOS
  if (/[.,]/.test(s)) {
    return Math.round(num * 100);
  }
  return Math.round(num);
};
