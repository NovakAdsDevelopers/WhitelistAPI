import { Arg, Mutation, Query, Resolver } from "type-graphql";
import { Trilha, TrilhaResult } from "../models/Trilha";
import { TrilhaService } from "../services/Trilha";
import { TrilhaInput, UpdateTrilhaInput } from "../inputs/Trilha";
import { Pagination } from "../../graphql/inputs/Utils";

@Resolver()
export class TrilhaResolver {
  private trilhaService = new TrilhaService();

  @Query(() => [TrilhaResult])
  async AcademyGetTrilhas(
    @Arg("pagination", () => Pagination, { nullable: true })
    pagination?: Pagination
  ) {
    return this.trilhaService.getTrilhas(pagination);
  }

  @Query(() => Trilha, { nullable: true })
  async AcademyGetTrilhaByID(@Arg("id") id: number) {
    return this.trilhaService.getTrilhaById(id);
  }

  @Mutation(() => Trilha)
  async AcademyCreateTrilha(@Arg("data") data: TrilhaInput) {
    return this.trilhaService.createTrilha(data);
  }

  @Mutation(() => Trilha)
  async AcademyUpdateTrilha(
    @Arg("id") id: number,
    @Arg("data") data: UpdateTrilhaInput
  ) {
    return this.trilhaService.updateTrilha(id, data);
  }

  @Mutation(() => String)
  async AcademyDeleteTrilha(@Arg("id") id: number) {
    return this.trilhaService.deleteTrilha(id);
  }
}
