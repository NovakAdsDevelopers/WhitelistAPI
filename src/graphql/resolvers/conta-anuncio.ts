import { Resolver, Query, Mutation, Arg, Int } from "type-graphql";
import { ContasAnuncio, ContasAnuncioGastoResult, ContasAnuncioResult } from "../models/conta-anuncio";
import { ContasAnuncioService } from "../services/conta-anuncio";
import { ContasAnuncioInput } from "../inputs/conta-anuncio";
import { Pagination } from "../inputs/Utils";
import { MetaPixResult } from "../models/conta-anuncio-pix";

@Resolver(ContasAnuncio)
export class ContasAnuncioResolver {
  private contasAnuncioService = new ContasAnuncioService();

  // Query com paginação
  @Query(() => ContasAnuncioResult)
  async GetContasAnuncio(
    @Arg("pagination", () => Pagination, { nullable: true })
    pagination?: Pagination
  ) {
    return this.contasAnuncioService.getAll(pagination);
  }

  // Query com paginação
  @Query(() => ContasAnuncioResult)
  async GetAllContasAnuncio(
    @Arg("pagination", () => Pagination, { nullable: true })
    pagination?: Pagination
  ) {
    return this.contasAnuncioService.getAllAccounts(pagination);
  }

  @Query(() => ContasAnuncioGastoResult)
  async GetAllContasAnuncioSpends(
    @Arg("pagination", () => Pagination, { nullable: true })
    pagination?: Pagination
  ) {
    return this.contasAnuncioService.getAllAccountsSpend(pagination);
  }

  @Query(() => MetaPixResult)
  async GetContaAnuncioFundos(
    @Arg("account_id", () => String) account_id: string,
    @Arg("pagination", () => Pagination, { nullable: true })
    pagination?: Pagination
  ) {
    return this.contasAnuncioService.getAllAccountsFunds(account_id, pagination);
  }

  @Query(() => ContasAnuncio, { nullable: true })
  async GetContaAnuncioByID(
    @Arg("account_id", () => String) account_id: string
  ) {
    return this.contasAnuncioService.getById(account_id);
  }

  @Mutation(() => ContasAnuncio)
  async SetContaAnuncio(@Arg("data") data: ContasAnuncioInput) {
    return this.contasAnuncioService.create(data);
  }

  @Mutation(() => ContasAnuncio)
  async PutContaAnuncio(
    @Arg("account_id", () => String) account_id: string,
    @Arg("data") data: ContasAnuncioInput
  ) {
    return this.contasAnuncioService.update(account_id, data);
  }

  @Mutation(() => Boolean)
  async DeleteContaAnuncio(
    @Arg("account_id", () => String) account_id: string
  ) {
    await this.contasAnuncioService.delete(account_id);
    return true;
  }

  @Mutation(() => Boolean)
  async switchStateAlert(
    @Arg("accountId") accountId: string,
    @Arg("alertaAtivo") alertaAtivo: boolean
  ): Promise<boolean> {
    await this.contasAnuncioService.switchAlerta(accountId, alertaAtivo);
    return true; // só confirma
  }
}
