// Retorna string local tipo "2025-06-30T14:45:00.000" (sem Z)
export function getLocalISOString(date: Date) {
  const offset = date.getTimezoneOffset() * 60000;
  const localDate = new Date(date.getTime() - offset);
  return localDate.toISOString().slice(0, 23); // remove o "Z"
}

// Retorna só a parte YYYY-MM-DD da data local
export function getLocalDateString(date: Date) {
  const offset = date.getTimezoneOffset() * 60000;
  const localDate = new Date(date.getTime() - offset);
  const y = localDate.getFullYear();
  const m = String(localDate.getMonth() + 1).padStart(2, '0');
  const d = String(localDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
