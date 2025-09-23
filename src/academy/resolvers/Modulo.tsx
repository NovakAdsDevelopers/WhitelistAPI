import { Arg, Mutation, Query, Resolver } from "type-graphql";
import { ModuloService } from "../services/Modulo";
import { Pagination } from "../../graphql/inputs/Utils";
import { ModuloResult } from "../models/Modulo";
import { ModuloInput, UpdateModuloInput } from "../inputs/Modulo";

@Resolver()
export class ModuloResolver {
  private moduloService = new ModuloService();

  @Query(() => [ModuloResult])
  async AcademyGetModulos(
    @Arg("id") id: number,
    @Arg("pagination", () => Pagination, { nullable: true })
    pagination?: Pagination
  ) {
    return this.moduloService.getModulos(id, pagination);
  }

  @Query(() => ModuloResult, { nullable: true })
  async AcademyGetModuloByID(@Arg("id") id: number) {
    return this.moduloService.getModuloById(id);
  }

  @Mutation(() => ModuloResult)
  async AcademyCreateModulo(@Arg("data") data: ModuloInput) {
    return this.moduloService.createModulo(data);
  }

  @Mutation(() => ModuloResult)
  async AcademyUpdateModulo(
    @Arg("id") id: number,
    @Arg("data") data: UpdateModuloInput
  ) {
    return this.moduloService.updateModulo(id, data);
  }

  @Mutation(() => String)
  async AcademyDeleteModulo(@Arg("id") id: number) {
    return this.moduloService.deleteModulo(id);
  }
}
