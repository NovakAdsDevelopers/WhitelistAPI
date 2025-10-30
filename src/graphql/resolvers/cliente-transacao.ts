import {
  Resolver,
  Query,
  Mutation,
  Arg,
  Int,
  UseMiddleware,
} from "type-graphql";
import { ClienteTransacao } from "../models/cliente-transacao"; // Model GraphQL
import { TransacaoClienteInput } from "../inputs/cliente-transacao";
import { TransacaoService } from "../services/cliente-transacao";
import { AuthMiddleware } from "../../middlewares/AuthMiddleware";

@Resolver(ClienteTransacao)
export class ClienteTransacaoResolver {
  private transacaoService = new TransacaoService();

  @Query(() => [ClienteTransacao])
  @UseMiddleware(AuthMiddleware)
  async GetClienteTransacoes(@Arg("cliente_id") clienteId: number) {
    return this.transacaoService.getAll(clienteId);
  }

  @Query(() => ClienteTransacao, { nullable: true })
  @UseMiddleware(AuthMiddleware)
  async GetClienteTransacaoByID(@Arg("id", () => Int) id: number) {
    return this.transacaoService.getById(id);
  }

  @Mutation(() => ClienteTransacao)
  @UseMiddleware(AuthMiddleware)
  async SetClienteTransacao(@Arg("data") data: TransacaoClienteInput) {
    return this.transacaoService.create(data);
  }

  @Mutation(() => ClienteTransacao)
  @UseMiddleware(AuthMiddleware)
  async PutClienteTransacao(
    @Arg("id", () => Int) id: number,
    @Arg("data") data: TransacaoClienteInput
  ) {
    return this.transacaoService.update(id, data);
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthMiddleware)
  async DeleteClienteTransacao(@Arg("id", () => Int) id: number) {
    await this.transacaoService.delete(id);
    return true;
  }
}
