// src/graphql/resolvers/InsightsResolver.ts
import { Resolver, Query, Arg } from "type-graphql";
import { InsightsService } from "../services/insights";
import {
  GastosPeriodosResponse,
  PanelInsightsResponse,
  RankingContasPeriodo
} from "../models/Insights";

@Resolver()
export class InsightsResolver {
  private insightsService = new InsightsService();

  @Query(() => PanelInsightsResponse)
  async GetInsightsPanel(
    @Arg("startDate", () => String) startDate: string,
    @Arg("endDate", () => String, { nullable: true }) endDate?: string
  ) {
    return this.insightsService.PanelInsights(startDate, endDate);
  }

  @Query(() => [RankingContasPeriodo])
  async GetInsightsPanelRelatorioRanking(
    @Arg("startDate", () => String) startDate: string,
    @Arg("endDate", () => String, { nullable: true }) endDate?: string
  ) {
    return this.insightsService.Ranking(startDate, endDate);
  }

  // ✅ Novo método para gráfico de linha
  @Query(() => GastosPeriodosResponse)
  async GetInsightsGastosPeriodos(
    @Arg("type", () => String) type: "week" | "mounth" | "tree-mouth" | "year"
  ): Promise<GastosPeriodosResponse> {
    return this.insightsService.GastosPeriodos(type);
  }
}
