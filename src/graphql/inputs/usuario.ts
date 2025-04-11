
import { InputType, Field } from "type-graphql";
import { TipoUsuario } from "../models/usuario";

@InputType()
export class UsuarioInput {
  @Field()
  nome!: string;

  @Field()
  email!: string;

  @Field()
  senha!: string;

  @Field(() => TipoUsuario, { nullable: true })
  tipo?: TipoUsuario;
}
