let ultimaExecucao: Date | null = null;
const INTERVALO_MINUTOS = 15;
const INTERVALO_MS = INTERVALO_MINUTOS * 60 * 1000; // 15 minutos em ms

export function registrarExecucao() {
  ultimaExecucao = new Date();
}

export function tempoRestanteMs(): number {
  const agora = new Date();

  // Calcula o próximo múltiplo de 15 minutos
  const minutos = agora.getMinutes();
  const proximoMultiplo = Math.ceil(minutos / INTERVALO_MINUTOS) * INTERVALO_MINUTOS;

  const proximaExecucao = new Date(agora);
  proximaExecucao.setMinutes(proximoMultiplo, 0, 0);

  // Se por algum motivo o horário calculado estiver no passado, adiciona mais 15 minutos
  if (proximaExecucao.getTime() <= agora.getTime()) {
    proximaExecucao.setMinutes(proximaExecucao.getMinutes() + INTERVALO_MINUTOS);
  }

  return proximaExecucao.getTime() - agora.getTime();
}
