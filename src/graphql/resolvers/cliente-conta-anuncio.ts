import { Resolver, Query, Mutation, Arg } from "type-graphql";
import { Pagination } from "../inputs/Utils";
import {
  ClienteContaAnuncioCreateManyInput,
  TransacaoClienteContaAnuncioInput,
} from "../inputs/cliente-conta-anuncio";
import { ClienteContaAnuncioService } from "../services/cliente-conta-anuncio";
import {
  ClienteContaAnuncioResult,
  SetClienteContaAnuncioResponse,
  SetTransacaoClienteContaAnuncioResponse,
} from "../models/cliente-conta-anuncio";

@Resolver()
export class ClienteContaAnuncioResolver {
  private service = new ClienteContaAnuncioService();

  @Query(() => ClienteContaAnuncioResult)
  async GetContasAssociadasPorCliente(
    @Arg("clienteId") clienteId: number,
    @Arg("pagination", () => Pagination, { nullable: true })
    pagination?: Pagination
  ) {
    return this.service.findByClienteId(clienteId, pagination);
  }

  @Mutation(() => SetClienteContaAnuncioResponse)
  async SetClienteContaAnuncio(
    @Arg("data") data: ClienteContaAnuncioCreateManyInput
  ) {
    return this.service.create(data);
  }

  @Mutation(() => SetTransacaoClienteContaAnuncioResponse)
  async SetTransacaoClienteContaAnuncio(
    @Arg("data") data: TransacaoClienteContaAnuncioInput
  ) {
    return this.service.push(data);
  }
}
