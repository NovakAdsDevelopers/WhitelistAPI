import { PrismaClient, Cliente } from "@prisma/client";
import { ClienteCreateInput, ClienteUpdateInput } from "../inputs/cliente";
import { Pagination } from "../inputs/Utils";
import getPageInfo from "../../helpers/getPageInfo";
import { IntegracaoCreateInput } from "../inputs/integracao";
import { fetchFacebookToken } from "../../meta/services/Token";
import axios from "axios";
import { fetchAllAdAccounts } from "../../meta/services/AdAccounts";
import { createORupdateBMs } from "../../meta/services/BusinessManager";

export class IntegracaoService {
  private prisma = new PrismaClient();

  async findAllBMs() {
    return this.prisma.bM.findMany();
  }

  async findAll(pagination?: Pagination, type?: string) {
    const pagina = Math.max(0, pagination?.pagina ?? 0);
    const quantidade = Math.min(100, Math.max(1, pagination?.quantidade ?? 10));

    try {
      const [rows, dataTotal] = await this.prisma.$transaction([
        this.prisma.token.findMany({
          skip: pagina * quantidade,
          take: quantidade,
          orderBy: { id: "asc" },
          include: {
            bms: {
              include: {
                _count: { select: { AdAccounts: true } }, // <- contador por BM
              },
            },
          },
        }),
        this.prisma.token.count(),
      ]);

      // mapeia: coloca adaccounts em cada BM e soma total por integração
      const integracoes = rows.map((it) => {
        const bms = it.bms.map((bm: any) => ({
          ...bm,
          adaccounts: bm._count?.AdAccounts ?? 0,
        }));

        const totalAdAccounts = bms.reduce(
          (acc: number, bm: any) => acc + (bm.adaccounts ?? 0),
          0
        );

        return {
          ...it,
          bms,
          totalAdAccounts, // <- disponível no GraphQL se você adicionou o campo
        };
      });

      const pageInfo = getPageInfo(dataTotal, pagina, quantidade);
      return { result: integracoes, pageInfo };
    } catch (err) {
      console.error("Erro ao buscar integrações:", err);
      throw new Error("Erro ao buscar integrações");
    }
  }

  // async findById(id: number) {
  //   const cliente = await this.prisma.cliente.findUnique({
  //     where: { id },
  //     include: {
  //       contasAnuncio: true,
  //     },
  //   });

  //   if (!cliente) return null;

  //   const contaIds = cliente.contasAnuncio.map((c) => c.id.toString());

  //   // Soma dos depósitos totais
  //   const depositoTotalContas = cliente.contasAnuncio.reduce((total, conta) => {
  //     const deposito = conta.depositoTotal?.toNumber?.() ?? 0;
  //     return total + deposito;
  //   }, 0);

  //   const gastosPorConta = await this.prisma.gastoDiario.groupBy({
  //     by: ["contaAnuncioId"],
  //     where: {
  //       contaAnuncioId: {
  //         in: contaIds, // agora é string[]
  //       },
  //     },
  //     _sum: {
  //       gasto: true,
  //     },
  //   });

  //   const gastoTotalContas = gastosPorConta.reduce((total, g) => {
  //     const valor = g._sum?.gasto?.toNumber?.() ?? 0;
  //     return total + valor;
  //   }, 0);

  //   // Cálculo do saldo total (depósitos - gastos)
  //   const saldoTotal = depositoTotalContas - gastoTotalContas;
  //   console.log(
  //     "CONTAS ASSOCIADAS:",
  //     JSON.stringify(cliente.contasAnuncio, null, 2)
  //   );
  //   console.log("DEPÓSITO TOTAL:", depositoTotalContas);
  //   console.log("GASTO TOTAL:", gastoTotalContas);
  //   console.log("SALDO CALCULADO:", saldoTotal);

  //   return {
  //     ...cliente,
  //     saldo: saldoTotal,
  //     gastoTotal: gastoTotalContas,
  //   };
  // }

  async create(data: IntegracaoCreateInput) {
    try {
      // Troca pelo long-lived token usando o fb_exchange_token
      const url = new URL(
        "https://graph.facebook.com/v23.0/oauth/access_token"
      );
      url.searchParams.append("grant_type", "fb_exchange_token");
      url.searchParams.append("client_id", data.client_id);
      url.searchParams.append("client_secret", data.secret_id);
      url.searchParams.append("fb_exchange_token", data.last_token);

      const response = await axios.get(url.toString());
      const tokenValue = response.data?.access_token;

      if (!tokenValue) {
        throw new Error("Falha ao obter token do Facebook");
      }

      // Prepara os dados para salvar no banco
      const tokenData: any = {
        title: data.title,
        client_id: data.client_id,
        secret_id: data.secret_id,
        last_token: data.last_token,
        token: tokenValue,
      };

      if (data.spend_date) {
        tokenData.spend_date = data.spend_date;
      }

      // Cria o registro no banco
      const integracao = await this.prisma.token.create({ data: tokenData });

      // Processa as integrações relacionadas
      await fetchAllAdAccounts(integracao.token);
      await createORupdateBMs(integracao.token, integracao.id);

      return integracao;
    } catch (error) {
      console.error("Erro ao criar integração:", error);
      throw new Error("Erro ao criar integração com o Facebook.");
    }
  }

  // async update(id: number, data: ClienteUpdateInput) {
  //   return this.prisma.cliente.update({
  //     where: { id },
  //     data: {
  //       nome: data.nome,
  //       email: data.email,
  //     },
  //   });
  // }

  // async delete(id: number) {
  //   try {
  //     const deleted = await this.prisma.cliente.delete({
  //       where: { id },
  //       select: { id: true },
  //     });
  //     return deleted.id;
  //   } catch (error) {
  //     return null; // ou lançar um erro, dependendo da sua lógica
  //   }
  // }
}
