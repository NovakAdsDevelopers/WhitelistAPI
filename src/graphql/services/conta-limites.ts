import { prisma } from "../../database";
import { ContaLimiteAjusteInput } from "../inputs/conta-limite";

export class ContaLimiteService {
  async ajusteLimite(data: ContaLimiteAjusteInput) {
    console.log(
      "[ajusteLimite] Iniciando ajuste de limites para conta:",
      data.contaAnuncioID
    );

    /* ─────────────── validações básicas ─────────────── */
    if (!data.contaAnuncioID) {
      console.error("[ajusteLimite] contaAnuncioID é obrigatório.");
      return { success: false, error: "ID da conta de anúncio é obrigatório." };
    }

    if (
      isNaN(Number(data.limiteCritico)) ||
      isNaN(Number(data.limiteMedio)) ||
      isNaN(Number(data.limiteInicial))
    ) {
      console.error("[ajusteLimite] Todos os limites devem ser números.");
      return { success: false, error: "Limites devem ser valores numéricos." };
    }

    if (typeof data.alertaAtivo !== "boolean") {
      console.error("[ajusteLimite] alertaAtivo deve ser booleano.");
      return { success: false, error: "alertaAtivo deve ser true ou false." };
    }

    /* ─────────────── update ─────────────── */
    try {
      const adAccount = await prisma.adAccount.update({
        where: { id: data.contaAnuncioID },
        data: {
          limiteCritico: data.limiteCritico,
          limiteMedio: data.limiteMedio,
          limiteInicial: data.limiteInicial,
          alertaAtivo: data.alertaAtivo, //  ←  agora incluído
        },
      });

      console.log(
        "[ajusteLimite] Limites/alerta atualizados com sucesso para conta:",
        adAccount.id
      );
      return { success: true, data: adAccount };
    } catch (error: any) {
      console.error(
        "[ajusteLimite] Erro ao atualizar os limites:",
        error.message || error
      );
      return {
        success: false,
        error:
          "Erro ao atualizar os limites. Verifique o ID da conta ou tente novamente.",
      };
    }
  }

  async getLimitesByContaId(contaAnuncioID: string) {
    console.log(
      "[getLimitesByContaId] Buscando limites da conta:",
      contaAnuncioID
    );

    if (!contaAnuncioID) {
      console.error("[getLimitesByContaId] contaAnuncioID é obrigatório.");
      return null;
    }

    try {
      const adAccount = await prisma.adAccount.findUnique({
        where: { id: contaAnuncioID },
        select: {
          id: true,
          limiteInicial: true,
          limiteMedio: true,
          limiteCritico: true,
          alertaAtivo: true,
        },
      });

      if (!adAccount) {
        console.warn(
          "[getLimitesByContaId] Conta não encontrada:",
          contaAnuncioID
        );
        return null; // ❗ importante: null, pois o campo no GraphQL é não-nullable
      }

      return {
        contaAnuncioID: adAccount.id,
        limiteInicial: adAccount.limiteInicial ?? "0",
        limiteMedio: adAccount.limiteMedio ?? "0",
        limiteCritico: adAccount.limiteCritico ?? "0",
        alertaAtivo: adAccount.alertaAtivo ?? true,
      };
    } catch (error: any) {
      console.error(
        "[getLimitesByContaId] Erro ao buscar limites:",
        error.message || error
      );
      return null;
    }
  }
}
