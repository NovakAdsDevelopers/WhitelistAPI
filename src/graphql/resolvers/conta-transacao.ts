import { Resolver, Query, Mutation, Arg, Int } from "type-graphql";
import { ContaTransacao } from "../models/conta-transacao"; // Model GraphQL
import { TransacaoContaInput } from "../inputs/conta-transacao";
import { TransacaoService } from "../services/conta-transacao";

@Resolver(ContaTransacao)
export class ContaTransacaoResolver {
  private transacaoService = new TransacaoService();

  @Query(() => [ContaTransacao])
  async GetContaTransacoes() {
    return this.transacaoService.getAll();
  }

  @Query(() => ContaTransacao, { nullable: true })
  async GetContaTransacaoByID(@Arg("id", () => Int) id: number) {
    return this.transacaoService.getById(id);
  }

  @Mutation(() => ContaTransacao)
  async SetContaTransacao(@Arg("data") data: TransacaoContaInput) {
    return this.transacaoService.create(data);
  }

  @Mutation(() => ContaTransacao)
  async PutContaTransacao(
    @Arg("id", () => Int) id: number,
    @Arg("data") data: TransacaoContaInput
  ) {
    return this.transacaoService.update(id, data);
  }

  @Mutation(() => Boolean)
  async DeleteContaTransacao(@Arg("id", () => Int) id: number) {
    await this.transacaoService.delete(id);
    return true;
  }
}
