import {
  Resolver,
  Query,
  Mutation,
  Arg,
  Int,
  UseMiddleware,
} from "type-graphql";
import { ContaTransacao } from "../models/conta-transacao"; // Model GraphQL
import { TransacaoContaInput } from "../inputs/conta-transacao";
import { TransacaoService } from "../services/conta-transacao";
import { AuthMiddleware } from "../../middlewares/AuthMiddleware";

@Resolver(ContaTransacao)
export class ContaTransacaoResolver {
  private transacaoService = new TransacaoService();

  @Query(() => [ContaTransacao])
  @UseMiddleware(AuthMiddleware)
  async GetContaTransacoes() {
    return this.transacaoService.getAll();
  }

  @Query(() => ContaTransacao, { nullable: true })
  @UseMiddleware(AuthMiddleware)
  async GetContaTransacaoByID(@Arg("id", () => Int) id: number) {
    return this.transacaoService.getById(id);
  }

  @Mutation(() => ContaTransacao)
  @UseMiddleware(AuthMiddleware)
  async SetContaTransacao(@Arg("data") data: TransacaoContaInput) {
    return this.transacaoService.create(data);
  }

  @Mutation(() => ContaTransacao)
  @UseMiddleware(AuthMiddleware)
  async PutContaTransacao(
    @Arg("id", () => Int) id: number,
    @Arg("data") data: TransacaoContaInput
  ) {
    return this.transacaoService.update(id, data);
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthMiddleware)
  async DeleteContaTransacao(@Arg("id", () => Int) id: number) {
    await this.transacaoService.delete(id);
    return true;
  }
}
