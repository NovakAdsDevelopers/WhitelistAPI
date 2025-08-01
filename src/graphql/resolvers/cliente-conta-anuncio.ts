import { Resolver, Query, Mutation, Arg } from "type-graphql";
import { Pagination } from "../inputs/Utils";
import {
  ClienteContaAnuncioCreateManyInput,
  ClienteContaAnuncioUpdateInput,
  TransacaoClienteContaAnuncioInput,
} from "../inputs/cliente-conta-anuncio";
import { ClienteContaAnuncioService } from "../services/cliente-conta-anuncio";
import {
  ClienteContaAnuncio,
  ClienteContaAnuncioResult,
  PutClienteContaAnuncioResponse,
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

  @Query(() => ClienteContaAnuncio)
  async GetContaAssociadaCliente(
    @Arg("clienteId") clienteId: number,
  ) {
    return this.service.findByAssociacaoId(clienteId);
  }

  @Mutation(() => SetClienteContaAnuncioResponse)
  async SetClienteContaAnuncio(
    @Arg("data") data: ClienteContaAnuncioCreateManyInput
  ) {
    return this.service.create(data);
  }

  @Mutation(() => PutClienteContaAnuncioResponse)
  async PutClienteContaAnuncio(
    @Arg("data") data: ClienteContaAnuncioUpdateInput
  ) {
    return this.service.update(data);
  }

  @Mutation(() => SetTransacaoClienteContaAnuncioResponse)
  async SetTransacaoClienteContaAnuncio(
    @Arg("data") data: TransacaoClienteContaAnuncioInput
  ) {
    return this.service.push(data);
  }
}
