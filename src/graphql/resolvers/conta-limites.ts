import { Resolver, Query, Mutation, Arg } from "type-graphql";
import { ClienteService } from "../services/cliente";
import { ClienteCreateInput, ClienteUpdateInput } from "../inputs/cliente";
import { Cliente, ClienteResult } from "../models/cliente";
import { ContaLimiteService } from "../services/conta-limites";
import { ContaLimiteAjusteInput } from "../inputs/conta-limite";
import { ContaLimiteModel } from "../models/conta-limite";

@Resolver()
export class ContaLimiteResolver {
  private contaService = new ContaLimiteService();

 @Query(() => ContaLimiteModel)
  async GetLimitesContaAnuncio(@Arg("contaAnuncioID") contaAnuncioID: string) {
    return this.contaService.getLimitesByContaId(contaAnuncioID);
  }

  @Mutation(() => ContaLimiteModel)
  async SetAjusteLimiteConta(@Arg("data") data: ContaLimiteAjusteInput) {
    return this.contaService.ajusteLimite(data);
  }
}
