import { Resolver, Query, Mutation, Arg } from "type-graphql";
import { ClienteService } from "../services/cliente";
import { ClienteCreateInput, ClienteUpdateInput } from "../inputs/cliente";
import { Cliente, ClienteResult } from "../models/cliente";
import { Pagination } from "../inputs/Utils";

@Resolver()
export class ClienteResolver {
  private clienteService = new ClienteService();

  @Query(() => ClienteResult)
  async GetClientes(
      @Arg("pagination", () => Pagination, { nullable: true })
      pagination?: Pagination
    )  {
    return this.clienteService.findAll(pagination);
  }

  @Query(() => Cliente, { nullable: true })
  async GetCliente(@Arg("id") id: number) {
    return this.clienteService.findById(id);
  }

  @Mutation(() => Cliente)
  async SetCliente(@Arg("data") data: ClienteCreateInput) {
    return this.clienteService.create(data);
  }

  @Mutation(() => Cliente, { nullable: true })
  async PutCliente(
    @Arg("id") id: number,
    @Arg("data") data: ClienteUpdateInput
  ) {
    return this.clienteService.update(id, data);
  }

  @Mutation(() => Boolean)
  async DeleteCliente(@Arg("id") id: number) {
    return this.clienteService.delete(id);
  }
}
