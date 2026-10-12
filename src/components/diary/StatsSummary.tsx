import React from 'react';
import { DashboardSummary } from '../../core/business/dashboard';

interface StatsSummaryProps {
  summary: DashboardSummary | null;
}

export const StatsSummary: React.FC<StatsSummaryProps> = ({ summary }) => {
  if (!summary) return null;

  return (
    <div className="dstats" id="dstats">
      <div className="dbox">
        <div className="l">Hoje</div>
        <div className="v">{summary.hoje} pág</div>
      </div>
      <div className="dbox">
        <div className="l">Sequência</div>
        <div className="v">
          {summary.streak} dia{summary.streak !== 1 ? 's' : ''}
        </div>
      </div>
      <div className="dbox">
        <div className="l">Total lido</div>
        <div className="v">{summary.totalLido} pág</div>
      </div>
      <div className="dbox">
        <div className="l">Registros</div>
        <div className="v">{summary.totalRegistros}</div>
      </div>
    </div>
  );
};
