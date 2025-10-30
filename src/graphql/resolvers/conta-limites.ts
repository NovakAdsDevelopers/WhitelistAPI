import { Resolver, Query, Mutation, Arg, UseMiddleware } from "type-graphql";
import { ClienteService } from "../services/cliente";
import { ClienteCreateInput, ClienteUpdateInput } from "../inputs/cliente";
import { Cliente, ClienteResult } from "../models/cliente";
import { ContaLimiteService } from "../services/conta-limites";
import { ContaLimiteAjusteInput } from "../inputs/conta-limite";
import { ContaLimiteModel } from "../models/conta-limite";
import { AuthMiddleware } from "../../middlewares/AuthMiddleware";

@Resolver()
export class ContaLimiteResolver {
  private contaService = new ContaLimiteService();

  @Query(() => ContaLimiteModel)
  @UseMiddleware(AuthMiddleware)
  async GetLimitesContaAnuncio(@Arg("contaAnuncioID") contaAnuncioID: string) {
    return this.contaService.getLimitesByContaId(contaAnuncioID);
  }

  @Mutation(() => ContaLimiteModel)
  @UseMiddleware(AuthMiddleware)
  async SetAjusteLimiteConta(@Arg("data") data: ContaLimiteAjusteInput) {
    return this.contaService.ajusteLimite(data);
  }
}
