import {
  Resolver,
  Query,
  Mutation,
  Arg,
  Int,
  UseMiddleware,
} from "type-graphql";
import {
  ContasAnuncio,
  ContasAnuncioGastoResult,
  ContasAnuncioResult,
} from "../models/conta-anuncio";
import { ContasAnuncioService } from "../services/conta-anuncio";
import { ContasAnuncioInput } from "../inputs/conta-anuncio";
import { Pagination } from "../inputs/Utils";
import { MetaPixResult } from "../models/conta-anuncio-pix";
import { AuthMiddleware } from "../../middlewares/AuthMiddleware";

@Resolver(ContasAnuncio)
export class ContasAnuncioResolver {
  private contasAnuncioService = new ContasAnuncioService();

  // Query com paginação
  @Query(() => ContasAnuncioResult)
  @UseMiddleware(AuthMiddleware)
  async GetContasAnuncio(
    @Arg("pagination", () => Pagination, { nullable: true })
    pagination?: Pagination
  ) {
    return this.contasAnuncioService.getAll(pagination);
  }

  // Query com paginação
  @Query(() => ContasAnuncioResult)
  @UseMiddleware(AuthMiddleware)
  async GetAllContasAnuncio(
    @Arg("pagination", () => Pagination, { nullable: true })
    pagination?: Pagination
  ) {
    return this.contasAnuncioService.getAllAccounts(pagination);
  }

  @Query(() => ContasAnuncioGastoResult)
  @UseMiddleware(AuthMiddleware)
  async GetAllContasAnuncioSpends(
    @Arg("pagination", () => Pagination, { nullable: true })
    pagination?: Pagination
  ) {
    return this.contasAnuncioService.getAllAccountsSpend(pagination);
  }

  @Query(() => MetaPixResult)
  @UseMiddleware(AuthMiddleware)
  async GetContaAnuncioFundos(
    @Arg("account_id", () => String) account_id: string,
    @Arg("pagination", () => Pagination, { nullable: true })
    pagination?: Pagination
  ) {
    return this.contasAnuncioService.getAllAccountsFunds(
      account_id,
      pagination
    );
  }

  @Query(() => ContasAnuncio, { nullable: true })
  @UseMiddleware(AuthMiddleware)
  async GetContaAnuncioByID(
    @Arg("account_id", () => String) account_id: string
  ) {
    return this.contasAnuncioService.getById(account_id);
  }

  @Mutation(() => ContasAnuncio)
  @UseMiddleware(AuthMiddleware)
  async SetContaAnuncio(@Arg("data") data: ContasAnuncioInput) {
    return this.contasAnuncioService.create(data);
  }

  @Mutation(() => ContasAnuncio)
  @UseMiddleware(AuthMiddleware)
  async PutContaAnuncio(
    @Arg("account_id", () => String) account_id: string,
    @Arg("data") data: ContasAnuncioInput
  ) {
    return this.contasAnuncioService.update(account_id, data);
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthMiddleware)
  async DeleteContaAnuncio(
    @Arg("account_id", () => String) account_id: string
  ) {
    await this.contasAnuncioService.delete(account_id);
    return true;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthMiddleware)
  async switchStateAlert(
    @Arg("accountId") accountId: string,
    @Arg("alertaAtivo") alertaAtivo: boolean
  ): Promise<boolean> {
    await this.contasAnuncioService.switchAlerta(accountId, alertaAtivo);
    return true; // só confirma
  }
}
