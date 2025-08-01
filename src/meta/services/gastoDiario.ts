import axios from "axios";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../../database";

export async function recalcularGastosDiarios(
  accessToken1: string,
  accessToken2: string,
  endDate?: string
): Promise<void> {
  const contas = await prisma.adAccount.findMany();
  const contasComErro: string[] = [];

  const today = endDate
    ? new Date(endDate).toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];

  for (const conta of contas) {
    const accountId = conta.id;

    const token =
      conta.BM === "BM1" ? accessToken1 :
      conta.BM === "BM2" ? accessToken2 :
      null;

    if (!token) {
      console.warn(`⚠️ Conta ${accountId} tem BM inválido: ${conta.BM}`);
      continue;
    }

    const startDate = "2024-06-01";

    const timeRange = encodeURIComponent(
      JSON.stringify({ since: startDate, until: today })
    );

    let url = `https://graph.facebook.com/v23.0/act_${accountId}/insights?access_token=${token}&fields=spend,date_start&time_increment=1&time_range=${timeRange}`;

    try {
      let hasNextPage = true;
      let page = 1;

      while (hasNextPage) {
        console.log(
          `📄 Buscando página ${page} para conta ${accountId} (${startDate} → ${today})`
        );
        const response = await axios.get(url);
        const insights = response.data?.data;

        if (!insights || insights.length === 0) break;

        for (const day of insights) {
          const date = new Date(day.date_start);
          const spend = parseFloat(day.spend || "0");

          // Verifica se já existe um registro no banco para a mesma data
          const gastoExistente = await prisma.gastoDiario.findUnique({
            where: {
              contaAnuncioId_data: {
                contaAnuncioId: accountId,
                data: date,
              },
            },
          });

          const valorExistente = gastoExistente?.gasto?.toNumber() ?? null;

          const precisaAtualizar = valorExistente === null || valorExistente !== spend;

          if (precisaAtualizar) {
            await prisma.gastoDiario.upsert({
              where: {
                contaAnuncioId_data: {
                  contaAnuncioId: accountId,
                  data: date,
                },
              },
              update: {
                gasto: spend.toString(),
              },
              create: {
                contaAnuncioId: accountId,
                data: date,
                gasto: spend.toString(),
              },
            });

            if (valorExistente === null) {
              console.log(
                `🆕 [${accountId}] Gasto do dia ${day.date_start} criado com valor R$ ${spend.toFixed(2)}`
              );
            } else {
              console.log(
                `🔁 [${accountId}] Gasto do dia ${day.date_start} atualizado: R$ ${valorExistente.toFixed(2)} → R$ ${spend.toFixed(2)}`
              );
            }
          } else {
            console.log(
              `⏩ [${accountId}] Gasto do dia ${day.date_start} já está atualizado (R$ ${spend.toFixed(2)}). Ignorando.`
            );
          }
        }

        if (response.data?.paging?.next) {
          url = response.data.paging.next;
          page++;
        } else {
          hasNextPage = false;
        }
      }

      // Atualizar gasto total
      console.log(`📊 Recalculando gasto total da conta ${accountId}...`);
      const totalGasto = await prisma.gastoDiario.aggregate({
        _sum: {
          gasto: true,
        },
        where: {
          contaAnuncioId: accountId,
        },
      });

      const gasto = totalGasto._sum.gasto ?? 0;
      const total = Math.floor(
        gasto instanceof Decimal ? gasto.toNumber() : Number(gasto)
      );

      await prisma.adAccount.update({
        where: { id: accountId },
        data: { gastoTotal: total },
      });

      console.log(`✅ Conta ${accountId} atualizada com gasto total: ${total}`);
    } catch (error: any) {
      contasComErro.push(accountId);
      console.error(
        `❌ Erro ao processar conta ${accountId}:`,
        error.response?.data || error.message || error
      );
    }
  }

  if (contasComErro.length > 0) {
    console.warn("⚠️ Contas com erro:", contasComErro.join(", "));
  }
}
