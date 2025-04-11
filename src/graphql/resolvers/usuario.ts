import { Resolver, Query, Mutation, Arg, Int } from "type-graphql";
import { LoginResponse, Usuario, UsuarioResult } from "../models/usuario";
import { UsuarioService } from "../services/usuario";
import { UsuarioInput } from "../inputs/usuario";
import { Pagination } from "../inputs/Utils";

@Resolver(Usuario)
export class UsuarioResolver {
  private usuarioService = new UsuarioService();

  @Query(() => UsuarioResult)
  async GetUsuarios(
    @Arg("pagination", () => Pagination, { nullable: true })
    pagination?: Pagination
  ) {
    return this.usuarioService.getAll(pagination);
  }

  @Query(() => Usuario, { nullable: true })
  async GetUsuarioByID(@Arg("id", () => Int) id: number) {
    return this.usuarioService.getById(id);
  }

  @Mutation(() => Usuario)
  async SetUsuario(@Arg("data") data: UsuarioInput) {
    return this.usuarioService.create(data);
  }

  @Mutation(() => Usuario)
  async PutUsuario(
    @Arg("id", () => Int) id: number,
    @Arg("data") data: UsuarioInput
  ) {
    return this.usuarioService.update(id, data);
  }

  @Mutation(() => Boolean)
  async DeleteUsuario(@Arg("id", () => Int) id: number) {
    await this.usuarioService.delete(id);
    return true;
  }

  @Mutation(() => LoginResponse)
  async Login(
    @Arg("email") email: string,
    @Arg("senha") senha: string
  ) {
    const token = await this.usuarioService.login(email, senha);
    return token;
  }
}
