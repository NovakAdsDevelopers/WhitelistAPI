// 🔧 Gera data no formato YYYY-MM-DD (ex: 2025-10-22)
export function formatarData(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// 🔧 Calcula o intervalo de 6 dias atrás até hoje
export function intervaloUltimos6Dias() {
  const hoje = new Date();
  const seisDiasAtras = new Date();
  seisDiasAtras.setDate(hoje.getDate() - 6);

  return {
    dataInicio: formatarData(seisDiasAtras),
    dataFim: formatarData(hoje),
  };
}
