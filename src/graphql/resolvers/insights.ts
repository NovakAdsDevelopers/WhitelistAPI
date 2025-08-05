import { Resolver, Query, Arg } from "type-graphql";
import { GastoTotalInput } from "../inputs/GastoTotalInput";
import { ContaGastoTotal } from "../models/ContaGastoTotal";
import { InsightsService } from "../services/insights";
import {
  PanelInsightsResponse,
  RankingContasPeriodo,
} from "../models/Insights";

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

  @Query(() => [RankingContasPeriodo])
  async GetInsightsPanelRelatorioRanking(
    @Arg("startDate", () => String) startDate: string,
    @Arg("endDate", () => String, { nullable: true }) endDate?: string
  ) {
    const ranking = await this.insightsService.Ranking(startDate, endDate);
    return ranking;
  }
}
