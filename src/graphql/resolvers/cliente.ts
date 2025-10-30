import {
  Resolver,
  Query,
  Mutation,
  Arg,
  ID,
  Int,
  UseMiddleware,
} from "type-graphql";
import { ClienteService } from "../services/cliente";
import { ClienteCreateInput, ClienteUpdateInput } from "../inputs/cliente";
import { Cliente, ClienteResult } from "../models/cliente";
import { Pagination } from "../inputs/Utils";
import { AuthMiddleware } from "../../middlewares/AuthMiddleware";

@Resolver()
export class ClienteResolver {
  private clienteService = new ClienteService();

  @Query(() => ClienteResult)
  @UseMiddleware(AuthMiddleware)
  async GetClientes(
    @Arg("pagination", () => Pagination, { nullable: true })
    pagination?: Pagination
  ) {
    return this.clienteService.findAll(pagination);
  }

  @Query(() => Cliente, { nullable: true })
  @UseMiddleware(AuthMiddleware)
  async GetCliente(@Arg("id") id: number) {
    return this.clienteService.findById(id);
  }

  @Mutation(() => Cliente)
  @UseMiddleware(AuthMiddleware)
  async SetCliente(@Arg("data") data: ClienteCreateInput) {
    return this.clienteService.create(data);
  }

  @Mutation(() => Cliente, { nullable: true })
  @UseMiddleware(AuthMiddleware)
  async PutCliente(
    @Arg("id") id: number,
    @Arg("data") data: ClienteUpdateInput
  ) {
    return this.clienteService.update(id, data);
  }

  @Mutation(() => Cliente)
  @UseMiddleware(AuthMiddleware)
  async DeleteCliente(@Arg("id", () => Int) id: number) {
    // Se a exclusão ocorrer, retorna o id; caso contrário, null.
    const deletedId = await this.clienteService.delete(id);

    return { id: deletedId };
  }
}
