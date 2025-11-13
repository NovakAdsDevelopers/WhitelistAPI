import {
  Resolver,
  Query,
  Mutation,
  Arg,
  ID,
  Int,
  UseMiddleware,
} from "type-graphql";
import { ClienteCreateInput, ClienteUpdateInput } from "../inputs/cliente";
import { Cliente } from "../models/cliente";
import { Pagination } from "../inputs/Utils";
import { IntegracaoService } from "../services/integracao";
import { IntegracaoModel, IntegracaoResult } from "../models/integracao";
import { IntegracaoCreateInput } from "../inputs/integracao";
import { AuthMiddleware } from "../../middlewares/AuthMiddleware";


@Resolver()
export class TestResolver {
  @Mutation(() => Boolean)
  boom(): boolean {
    throw new Error("teste-log-graphql");
  }
}

@Resolver()
export class IntegracaoResolver {
  private integracaoService = new IntegracaoService();



  @Query(() => IntegracaoResult)
  @UseMiddleware(AuthMiddleware)
  async GetIntegracoes(
    @Arg("pagination", () => Pagination, { nullable: true })
    pagination?: Pagination,
    @Arg("type", () => String, { nullable: true })
    type?: string
  ) {
    return this.integracaoService.findAll(pagination, type);
  }

  // @Query(() => Cliente, { nullable: true })
  // async GetCliente(@Arg("id") id: number) {
  //   return this.integracaoService.findById(id);
  // }

  @Mutation(() => IntegracaoModel)
  @UseMiddleware(AuthMiddleware)
  async SetIntegracao(@Arg("data") data: IntegracaoCreateInput) {
    return this.integracaoService.create(data);
  }

  // @Mutation(() => Cliente, { nullable: true })
  // async PutCliente(
  //   @Arg("id") id: number,
  //   @Arg("data") data: ClienteUpdateInput
  // ) {
  //   return this.clienteService.update(id, data);
  // }

  // @Mutation(() => Cliente)
  // async DeleteCliente(@Arg("id", () => Int) id: number) {
  //   // Se a exclusão ocorrer, retorna o id; caso contrário, null.
  //   const deletedId = await this.clienteService.delete(id);

  //   return { id: deletedId };
  // }
}
