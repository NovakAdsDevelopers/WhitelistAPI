import { Resolver, Query, Mutation, Arg, Int } from "type-graphql";
import { ClienteTransacao } from "../models/cliente-transacao"; // Model GraphQL
import { TransacaoClienteInput } from "../inputs/cliente-transacao";
import { TransacaoService } from "../services/cliente-transacao";

@Resolver(ClienteTransacao)
export class ClienteTransacaoResolver {
  private transacaoService = new TransacaoService();

  @Query(() => [ClienteTransacao])
  async GetClienteTransacoes(@Arg("cliente_id") clienteId: number) {
    return this.transacaoService.getAll(clienteId);
  }

  @Query(() => ClienteTransacao, { nullable: true })
  async GetClienteTransacaoByID(@Arg("id", () => Int) id: number) {
    return this.transacaoService.getById(id);
  }

  @Mutation(() => ClienteTransacao)
  async SetClienteTransacao(@Arg("data") data: TransacaoClienteInput) {
    return this.transacaoService.create(data);
  }

  @Mutation(() => ClienteTransacao)
  async PutClienteTransacao(
    @Arg("id", () => Int) id: number,
    @Arg("data") data: TransacaoClienteInput
  ) {
    return this.transacaoService.update(id, data);
  }

  @Mutation(() => Boolean)
  async DeleteClienteTransacao(@Arg("id", () => Int) id: number) {
    await this.transacaoService.delete(id);
    return true;
  }
}
