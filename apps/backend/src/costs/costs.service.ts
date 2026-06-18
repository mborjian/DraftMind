import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class CostsService {
  constructor(private readonly databaseService: DatabaseService) {}

  getCosts() {
    const summary = this.databaseService.get<{
      totalRequests: number;
      totalTokens: number;
      estimatedSpending: number;
    }>(
      `SELECT COUNT(*) AS totalRequests,
        COALESCE(SUM(totalTokens), 0) AS totalTokens,
        COALESCE(SUM(estimatedCost), 0) AS estimatedSpending
       FROM AIRequestLog`,
    ) ?? { totalRequests: 0, totalTokens: 0, estimatedSpending: 0 };

    const byProvider = this.databaseService.all(
      `SELECT COALESCE(AIProvider.name, 'Unknown') AS providerName,
        COUNT(AIRequestLog.id) AS requestCount,
        COALESCE(SUM(AIRequestLog.totalTokens), 0) AS totalTokens,
        COALESCE(SUM(AIRequestLog.estimatedCost), 0) AS estimatedCost
       FROM AIRequestLog
       LEFT JOIN AIProvider ON AIProvider.id = AIRequestLog.providerId
       GROUP BY providerName
       ORDER BY estimatedCost DESC`,
    );

    const byModel = this.databaseService.all(
      `SELECT model, COUNT(id) AS requestCount, COALESCE(SUM(totalTokens), 0) AS totalTokens,
        COALESCE(SUM(estimatedCost), 0) AS estimatedCost
       FROM AIRequestLog GROUP BY model ORDER BY estimatedCost DESC`,
    );

    return {
      ...summary,
      byProvider,
      byModel,
    };
  }
}
