import {
  Resolver,
  Query,
  Mutation,
  Arg,
  Int,
  UseMiddleware,
  Ctx,
} from "type-graphql";
import { LoginResponse, Usuario, UsuarioResult } from "../models/usuario";
import { UsuarioService } from "../services/usuario";
import { UsuarioInput } from "../inputs/usuario";
import { Pagination } from "../inputs/Utils";
import { RequireRole } from "../../middlewares/RoleMiddleware";
import { AuthMiddleware } from "../../middlewares/AuthMiddleware";
import { MyContext } from "../../context/buildContext";

@Resolver(Usuario)
export class UsuarioResolver {
  private usuarioService = new UsuarioService();

  // 🔒 ADMIN somente
  @Query(() => UsuarioResult)
  @UseMiddleware(AuthMiddleware, RequireRole("ADMIN"))
  async GetUsuarios(
    @Arg("pagination", () => Pagination, { nullable: true })
    pagination?: Pagination
  ) {
    return this.usuarioService.getAll(pagination);
  }

  // 🔐 Autenticado (qualquer tipo)
  @Query(() => Usuario, { nullable: true })
  @UseMiddleware(AuthMiddleware)
  async GetUsuarioByID(
    @Arg("id", () => Int) id: number,
    @Ctx() _ctx: MyContext
  ) {
    return this.usuarioService.getById(id);
  }

  // 🔐 Autenticado (qualquer tipo)
  @Mutation(() => Usuario)
  async SetUsuario(@Arg("data") data: UsuarioInput, @Ctx() _ctx: MyContext) {
    return this.usuarioService.create(data);
  }

  // 🔐 Autenticado (qualquer tipo)
  @Mutation(() => Usuario)
  @UseMiddleware(AuthMiddleware)
  async PutUsuario(
    @Arg("id", () => Int) id: number,
    @Arg("data") data: UsuarioInput,
    @Ctx() _ctx: MyContext
  ) {
    return this.usuarioService.update(id, data);
  }

  // 🔒 ADMIN somente
  @Mutation(() => Boolean)
  @UseMiddleware(AuthMiddleware, RequireRole("ADMIN"))
  async DeleteUsuario(
    @Arg("id", () => Int) id: number,
    @Ctx() _ctx: MyContext
  ) {
    await this.usuarioService.delete(id);
    return true;
  }

  // 🌐 Público (sem auth)
  @Mutation(() => LoginResponse)
  async Login(
    @Arg("email") email: string,
    @Arg("senha") senha: string,
    @Ctx() ctx: any // Apollo injeta { req, res } aqui
  ) {
    const { token } = await this.usuarioService.login(email, senha);

    // grava o JWT em cookie httpOnly (inacessível ao JS do browser)
    ctx.res.cookie("jwt", token, {
      httpOnly: true, // protege contra XSS
      secure: process.env.NODE_ENV === "production", // usa HTTPS em prod
      sameSite: "lax", // "strict" se quiser bloquear ainda mais
      path: "/", // cookie disponível para toda a app
      maxAge: 60 * 1000, // ⏰ expira em 1 minuto (milissegundos)
    });

    // opcional: retorna o token (compatibilidade) ou flag de sucesso
    return { token };
  }
}
