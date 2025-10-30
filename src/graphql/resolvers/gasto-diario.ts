import { Resolver, Query, Arg, UseMiddleware } from "type-graphql";
import { GastoTotalInput } from "../inputs/GastoTotalInput";
import { ContaGastoTotal } from "../models/ContaGastoTotal";
import { GastoDiarioService } from "../services/gasto-diario";
import { AuthMiddleware } from "../../middlewares/AuthMiddleware";

@Resolver()
export class GastoDiarioResolver {
  private gastoDiarioService = new GastoDiarioService();

  @Query(() => ContaGastoTotal)
  @UseMiddleware(AuthMiddleware)
  async GetGastoTotalContaAnuncioByID(
    @Arg("data", () => GastoTotalInput) data: GastoTotalInput
  ): Promise<ContaGastoTotal> {
    const total = await this.gastoDiarioService.calcularGastoTotalPorPeriodo(
      data.account_id,
      data.startDate,
      data.endDate
    );

    return { gastoTotal: total };
  }
}
