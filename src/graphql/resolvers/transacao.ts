import { Resolver, Query, Mutation, Arg, Int } from "type-graphql";
import { Transacao } from "../models/transacao"; // Model GraphQL
import { TransacaoInput } from "../inputs/transacao";
import { TransacaoService } from "../services/transacao";

@Resolver(Transacao)
export class TransacaoResolver {
  private transacaoService = new TransacaoService();

  @Query(() => [Transacao])
  async GetTransacoes() {
    return this.transacaoService.getAll();
  }

  @Query(() => Transacao, { nullable: true })
  async GetTransacaoByID(@Arg("id", () => Int) id: number) {
    return this.transacaoService.getById(id);
  }

  @Mutation(() => Transacao)
  async SetTransacao(@Arg("data") data: TransacaoInput) {
    return this.transacaoService.create(data);
  }

  @Mutation(() => Transacao)
  async PutTransacao(
    @Arg("id", () => Int) id: number,
    @Arg("data") data: TransacaoInput
  ) {
    return this.transacaoService.update(id, data);
  }

  @Mutation(() => Boolean)
  async DeleteTransacao(@Arg("id", () => Int) id: number) {
    await this.transacaoService.delete(id);
    return true;
  }
}
