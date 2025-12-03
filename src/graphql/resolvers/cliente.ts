import {
  Resolver,
  Query,
  Mutation,
  Arg,
  ID,
  Int,
  UseMiddleware,
  Ctx,
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






  @Mutation(() => Cliente, { nullable: true })
  async LoginCliente(
    @Arg("email") email: string,
    @Arg("senha") senha: string,
    @Ctx() { res }: any
  ) {
    const { cliente, token } = await this.clienteService.login(email, senha);

    // Define cookie HttpOnly
    res.cookie("token", token, {
      httpOnly: true,
      secure: false, // coloque true em produção (https)
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
    });

    return cliente;
  }

  @Mutation(() => Boolean)
  async LogoutCliente(@Ctx() { res }: any) {
    res.clearCookie("token");
    return true;
  }

  @Query(() => Cliente, { nullable: true })
  @UseMiddleware(AuthMiddleware)
  async Me(@Ctx() { cliente }: any) {
    return cliente;
  }
}
