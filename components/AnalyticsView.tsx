import React from 'react';
import { Task, TaskStatus } from '../types';
import { BarChart3, CheckCircle2, TrendingUp, AlertTriangle } from 'lucide-react';

interface AnalyticsViewProps {
  tasks: Task[];
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ tasks }) => {
  const total = tasks.length;
  const completed = tasks.filter(t => t.status === TaskStatus.COMPLETED).length;
  const inProgress = tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length;
  const todo = tasks.filter(t => t.status === TaskStatus.TODO).length;
  
  const completionRate = total === 0 ? 0 : Math.round((completed / total) * 100);
  
  // Overdue calculation
  const now = new Date();
  const overdue = tasks.filter(t => t.status !== TaskStatus.COMPLETED && new Date(t.dueDate) < now).length;

  // Generate Real Heatmap Data (Last 7 Days)
  const getWeeklyHeatmap = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const heatmapData = [];
    
    // Iterate backwards from today for 7 days
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayStr = d.toDateString();
        const dayLabel = days[d.getDay()];

        // Calculate activity (created + due) for this day
        const activityCount = tasks.filter(t => {
            const created = new Date(t.createdAt).toDateString() === dayStr;
            const due = new Date(t.dueDate).toDateString() === dayStr;
            return created || due;
        }).length;
        
        // Normalize roughly to 100% (assuming max 10 tasks/day is "full" load for heatmap visual)
        const percentage = Math.min((activityCount / 8) * 100, 100);
        
        heatmapData.push({ day: dayLabel, value: percentage, count: activityCount });
    }
    return heatmapData;
  };

  const weeklyData = getWeeklyHeatmap();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-carbon border border-garnet/30 rounded-xl p-6 shadow-lg">
            <h2 className="text-xl font-bold text-smoke flex items-center gap-2 mb-6">
                <BarChart3 className="w-5 h-5 text-strawberry" />
                Productivity Dashboard
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-onyx p-4 rounded-lg border border-garnet/20">
                    <p className="text-xs text-silver/60 uppercase tracking-wide">Completion Rate</p>
                    <p className="text-2xl font-bold text-smoke mt-1">{completionRate}%</p>
                    <div className="w-full h-1 bg-carbon mt-2 rounded-full overflow-hidden">
                        <div className="h-full bg-strawberry" style={{width: `${completionRate}%`}}></div>
                    </div>
                </div>
                <div className="bg-onyx p-4 rounded-lg border border-garnet/20">
                    <p className="text-xs text-silver/60 uppercase tracking-wide">Completed</p>
                    <p className="text-2xl font-bold text-green-400 mt-1 flex items-center gap-2">
                        {completed} <CheckCircle2 className="w-4 h-4 opacity-50"/>
                    </p>
                </div>
                 <div className="bg-onyx p-4 rounded-lg border border-garnet/20">
                    <p className="text-xs text-silver/60 uppercase tracking-wide">Pending</p>
                    <p className="text-2xl font-bold text-silver mt-1">{todo + inProgress}</p>
                </div>
                <div className="bg-onyx p-4 rounded-lg border border-garnet/20">
                    <p className="text-xs text-silver/60 uppercase tracking-wide">Overdue</p>
                    <p className={`text-2xl font-bold mt-1 ${overdue > 0 ? 'text-mahogany' : 'text-silver'}`}>
                        {overdue}
                    </p>
                </div>
            </div>

            {/* Productivity Heatmap */}
            <div className="mb-6">
                <h3 className="text-sm font-semibold text-silver mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4"/> Weekly Activity Load (Last 7 Days)
                </h3>
                <div className="flex gap-1 h-24 items-end bg-onyx/30 p-2 rounded-lg border border-garnet/10">
                    {weeklyData.map((data, i) => (
                        <div key={i} className="flex-1 flex flex-col justify-end h-full gap-2 group relative">
                             <div className="w-full bg-garnet/20 hover:bg-strawberry/50 transition-colors rounded-t-sm relative flex-1 cursor-help">
                                 <div 
                                    className="absolute bottom-0 left-0 w-full bg-strawberry transition-all duration-500 rounded-t-sm" 
                                    style={{height: `${Math.max(data.value, 5)}%`}}
                                 ></div>
                             </div>
                             <span className="text-[10px] text-silver/50 text-center font-mono uppercase">{data.day}</span>
                             
                             {/* Tooltip */}
                             <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-carbon border border-garnet/30 text-white text-xs px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                                {data.count} Tasks
                             </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-mahogany/10 border border-mahogany/30 p-4 rounded-lg flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-mahogany shrink-0 mt-0.5" />
                <div>
                    <h4 className="text-sm font-bold text-strawberry">AI Insight</h4>
                    <p className="text-xs text-silver mt-1">
                        {completionRate < 50 
                            ? "You have a high volume of pending tasks. Try breaking them down using the AI 'Refine' tool."
                            : "Great momentum! You are clearing tasks efficiently. Consider setting higher priority goals for tomorrow."}
                    </p>
                </div>
            </div>
        </div>
    </div>
  );
};