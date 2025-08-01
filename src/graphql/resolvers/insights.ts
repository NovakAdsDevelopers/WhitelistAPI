import { Resolver, Query, Arg } from "type-graphql";
import { GastoTotalInput } from "../inputs/GastoTotalInput";
import { ContaGastoTotal } from "../models/ContaGastoTotal";
import { InsightsService } from "../services/insights";
import { PanelInsightsResponse } from "../models/Insights";

@Resolver()
export class InsightsResolver {
  private insightsService = new InsightsService();

  @Query(() => PanelInsightsResponse)
  async GetInsightsPanel(
    @Arg("startDate", () => String) startDate: string,
    @Arg("endDate", () => String, { nullable: true }) endDate?: string
  ) {
    const insightsPanel = await this.insightsService.PanelInsights(
      startDate,
      endDate
    );

    return insightsPanel;
  }
}
