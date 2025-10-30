// src/graphql/resolvers/InsightsResolver.ts
import { Resolver, Query, Arg, UseMiddleware } from "type-graphql";
import { InsightsService } from "../services/insights";
import {
  GastosPeriodosResponse,
  PanelInsightsAdAccountResponse,
  PanelInsightsResponse,
  RankingContasPeriodo,
} from "../models/Insights";
import { AuthMiddleware } from "../../middlewares/AuthMiddleware";

@Resolver()
export class InsightsResolver {
  private insightsService = new InsightsService();

  @Query(() => PanelInsightsResponse)
  @UseMiddleware(AuthMiddleware)
  async GetInsightsPanel(
    @Arg("BMs", () => [String], { nullable: true }) BMs: string[],
    @Arg("startDate", () => String) startDate: string,
    @Arg("endDate", () => String, { nullable: true }) endDate?: string
  ) {
    return this.insightsService.PanelInsights(BMs, startDate, endDate);
  }

  @Query(() => PanelInsightsAdAccountResponse)
  @UseMiddleware(AuthMiddleware)
  async GetInsightsAdAccount(
    @Arg("adAccountId", () => String, { nullable: true }) adAccountId: string,
    @Arg("startDate", () => String) startDate: string,
    @Arg("endDate", () => String, { nullable: true }) endDate?: string
  ) {
    return this.insightsService.AdAccountInsights(
      adAccountId,
      startDate,
      endDate
    );
  }

  @Query(() => [RankingContasPeriodo])
  @UseMiddleware(AuthMiddleware)
  async GetInsightsPanelRelatorioRanking(
    @Arg("BMs", () => [String], { nullable: true }) BMs: string[],
    @Arg("startDate", () => String) startDate: string,
    @Arg("endDate", () => String, { nullable: true }) endDate?: string
  ) {
    return this.insightsService.Ranking(BMs, startDate, endDate);
  }

  // ✅ Novo método para gráfico de linha
  @Query(() => GastosPeriodosResponse)
  @UseMiddleware(AuthMiddleware)
  async GetInsightsGastosPeriodos(
    @Arg("adAccountId", () => String, { nullable: true }) adAccountId: string,
    @Arg("type", () => String) type: "week" | "mounth" | "tree-mouth" | "year"
  ): Promise<GastosPeriodosResponse> {
    return this.insightsService.GastosPeriodos(type, adAccountId);
  }
}
