import React from 'react';
import { DayStat } from '../../core/business/dashboard';

interface WeeklyChartProps {
  days: DayStat[];
}

export const WeeklyChart: React.FC<WeeklyChartProps> = ({ days }) => {
  return (
    <div className="week" id="week" aria-label="Gráfico de leitura dos últimos 7 dias">
      {days.map((d) => (
        <div key={d.date} className={`wcol ${d.isToday ? 'today' : ''}`}>
          <span className="v">{d.pages > 0 ? d.pages : ''}</span>
          <div className="bar" style={{ height: `${d.barHeight}px` }} />
          <span className="l">{d.label}</span>
        </div>
      ))}
    </div>
  );
};
