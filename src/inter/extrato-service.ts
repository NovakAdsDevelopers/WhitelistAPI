import { consultarExtratoCompleto, getInterToken } from ".";
import { TransacaoExtrato } from "../script";
import { intervaloUltimos6Dias } from "./util";
import { prisma } from "../database";
import { Prisma } from "@prisma/client";
import crypto from "node:crypto";

// ============================================================================
// 🔧 Tipos auxiliares
// ============================================================================
type ExtratoParams = {
  tipo?: "entrada" | "saida" | "todos";
  tipoTransacao?: string;
  dataInicio?: string;
  dataFim?: string;
  order?: "asc" | "desc";
  pagina?: number;
  tamanhoPagina?: number;
};

type TipoOperacao = "C" | "D";

// ============================================================================
// 🧩 Funções utilitárias
// ============================================================================
function gerarFingerprint(tx: TransacaoExtrato) {
  const base = JSON.stringify({
    dataEntrada: tx.dataEntrada ?? null,
    valor: tx.valor ?? null,
    descricao: tx.descricao ?? null,
    tipoOperacao: tx.tipoOperacao ?? null,
    tipoTransacao: tx.tipoTransacao ?? null,
    idTransacao: (tx as any).idTransacao ?? null,
    nsu: (tx as any).nsu ?? null,
    id: (tx as any).id ?? null,
  });
  return crypto.createHash("sha256").update(base).digest("hex");
}

function mapearTransacaoParaDB(tx: TransacaoExtrato) {
  return {
    externalId: (tx as any).idTransacao || (tx as any).nsu || (tx as any).id || null,
    fingerprint: gerarFingerprint(tx),
    dataEntrada: tx.dataInclusao
      ? new Date(tx.dataInclusao)
      : tx.dataEntrada
      ? new Date(tx.dataEntrada)
      : null,
    dataEfetivacao: tx.dataTransacao
      ? new Date(`${tx.dataTransacao}T00:00:00Z`)
      : null,
    valor: new Prisma.Decimal(tx.valor ?? 0),
    descricao: tx.descricao ?? null,
    tipoOperacao: tx.tipoOperacao ?? null,
    tipoTransacao: tx.tipoTransacao ?? null,
    raw: tx,
  };
}

// ============================================================================
// 🔍 Consulta o extrato completo (usado por rotas e cron)
// ============================================================================
export async function consultarExtratoJob(params: ExtratoParams = {}) {
  const {
    tipo,
    tipoTransacao,
    dataInicio: qDataInicio,
    dataFim: qDataFim,
    order: qOrder,
    pagina: qPagina = 0,
    tamanhoPagina: qTamanhoPagina = 1000,
  } = params;

  const inicioExec = Date.now();

  try {
    console.log("🔍 [EXTRATO] Iniciando consulta ao Inter...");
    const { dataInicio: defInicio, dataFim: defFim } = intervaloUltimos6Dias();
    const dataInicio = qDataInicio?.trim() || defInicio;
    const dataFim = qDataFim?.trim() || defFim;
    console.log(`📆 [EXTRATO] Intervalo: ${dataInicio} → ${dataFim}`);

    const token = await getInterToken({
      clientId: process.env.INTER_CLIENT_ID!,
      clientSecret: process.env.INTER_CLIENT_SECRET!,
      scope: "extrato.read",
      passphrase: process.env.INTER_CERT_PASSPHRASE,
    });

    let tipoOperacao: TipoOperacao | undefined;
    if (tipo === "entrada") tipoOperacao = "C";
    else if (tipo === "saida") tipoOperacao = "D";

    const extrato = await consultarExtratoCompleto({
      token,
      dataInicio,
      dataFim,
      pagina: qPagina,
      tamanhoPagina: qTamanhoPagina,
      tipoOperacao,
      tipoTransacao: tipoTransacao?.trim() || undefined,
    });

    const transacoes: TransacaoExtrato[] =
      (extrato as any).transacoes ?? (extrato as any).movimentacoes ?? [];

    const order = qOrder === "asc" ? "asc" : "desc";
    transacoes.sort((a, b) => {
      const da = a.dataEntrada ?? "";
      const db = b.dataEntrada ?? "";
      const cmp = db.localeCompare(da);
      return order === "desc" ? cmp : -cmp;
    });

    const tempo = ((Date.now() - inicioExec) / 1000).toFixed(2);
    console.log(`✅ [EXTRATO] Consulta concluída (${transacoes.length} transações, ${tempo}s)`);

    return { dataInicio, dataFim, transacoes };
  } catch (error: any) {
    console.error("❌ [EXTRATO] Erro na consulta:", error);
    throw error;
  }
}

// ============================================================================
// 💾 Verifica se transação existe e cria ou atualiza conforme necessário
// ============================================================================
async function upsertTransacao(txData: ReturnType<typeof mapearTransacaoParaDB>) {
  const { externalId, fingerprint } = txData;

  const existente = await prisma.extratoTransacaoInter.findFirst({
    where: {
      OR: [
        { externalId: { equals: externalId || "" } },
        { fingerprint },
      ],
    },
  });

  if (!existente) {
    await prisma.extratoTransacaoInter.create({ data: txData });
    console.log(`🟢 [JOB] Nova transação inserida (${externalId || fingerprint})`);
    return "created";
  }

  // Verifica se mudou algo relevante
  const mudou =
    existente.valor.toString() !== txData.valor.toString() ||
    existente.descricao !== txData.descricao ||
    existente.tipoOperacao !== txData.tipoOperacao ||
    existente.tipoTransacao !== txData.tipoTransacao ||
    existente.dataEntrada?.getTime() !== txData.dataEntrada?.getTime() ||
    existente.dataEfetivacao?.getTime() !== txData.dataEfetivacao?.getTime();

  if (mudou) {
    await prisma.extratoTransacaoInter.update({
      where: { id: existente.id },
      data: txData,
    });
    console.log(`🟡 [JOB] Transação atualizada (${externalId || fingerprint})`);
    return "updated";
  }

  return "skipped";
}

// ============================================================================
// 🚀 Consulta e sincroniza (cria/atualiza) o extrato no banco
// ============================================================================
export async function salvarExtratoJob(dataInicio?: string) {
  const inicioExec = Date.now();

  try {
    console.log("⏰ [JOB] Iniciando sincronização do extrato...");

    const hoje = new Date();
    const dataFim = new Date(hoje.getTime() - hoje.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);

    const { transacoes } = await consultarExtratoJob({
      dataInicio: dataInicio ?? intervaloUltimos6Dias().dataInicio,
      dataFim,
    });

    if (!transacoes.length) {
      console.log("⚠️ [JOB] Nenhuma transação encontrada.");
      return;
    }

    console.log(`📊 [JOB] ${transacoes.length} transações retornadas. Iniciando comparação...`);

    let criadas = 0;
    let atualizadas = 0;
    let ignoradas = 0;

    for (const tx of transacoes) {
      const resultado = await upsertTransacao(mapearTransacaoParaDB(tx));
      if (resultado === "created") criadas++;
      else if (resultado === "updated") atualizadas++;
      else ignoradas++;
    }

    const tempo = ((Date.now() - inicioExec) / 1000).toFixed(2);
    console.log(
      `✅ [JOB] Sincronização concluída: ${criadas} novas, ${atualizadas} atualizadas, ${ignoradas} sem mudanças.`
    );
    console.log(`⏱️ Tempo total: ${tempo}s.`);
  } catch (error: any) {
    console.error("❌ [JOB] Erro na sincronização do extrato:", error.message);
  }
}
