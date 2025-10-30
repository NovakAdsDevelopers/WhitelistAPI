import { Resolver, Query, Mutation, Arg, UseMiddleware } from "type-graphql";
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
import { AuthMiddleware } from "../../middlewares/AuthMiddleware";

@Resolver()
export class ClienteContaAnuncioResolver {
  private service = new ClienteContaAnuncioService();

  @Query(() => ClienteContaAnuncioResult)
  @UseMiddleware(AuthMiddleware)
  async GetContasAssociadasPorCliente(
    @Arg("clienteId") clienteId: number,
    @Arg("pagination", () => Pagination, { nullable: true })
    pagination?: Pagination
  ) {
    return this.service.findByClienteId(clienteId, pagination);
  }

  @Query(() => ClienteContaAnuncio)
  @UseMiddleware(AuthMiddleware)
  async GetContaAssociadaCliente(@Arg("clienteId") clienteId: number) {
    return this.service.findByAssociacaoId(clienteId);
  }

  @Mutation(() => SetClienteContaAnuncioResponse)
  @UseMiddleware(AuthMiddleware)
  async SetClienteContaAnuncio(
    @Arg("data") data: ClienteContaAnuncioCreateManyInput
  ) {
    return this.service.create(data);
  }

  @Mutation(() => PutClienteContaAnuncioResponse)
  @UseMiddleware(AuthMiddleware)
  async PutClienteContaAnuncio(
    @Arg("data") data: ClienteContaAnuncioUpdateInput
  ) {
    return this.service.update(data);
  }

  @Mutation(() => SetTransacaoClienteContaAnuncioResponse)
  @UseMiddleware(AuthMiddleware)
  async SetTransacaoClienteContaAnuncio(
    @Arg("data") data: TransacaoClienteContaAnuncioInput
  ) {
    return this.service.push(data);
  }
}
