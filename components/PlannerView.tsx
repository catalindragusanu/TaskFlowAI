import React, { useState, useEffect } from 'react';
import { Task, ScheduleItem, PlanTemplate, IconKey } from '../types';
import { generateDailyPlan } from '../services/geminiService';
import { getScheduleCalendarUrl } from '../utils/dateUtils';
import { db } from '../services/databaseService';
import { Loader2, Sparkles, Coffee, Briefcase, Zap, Calendar, ArrowRight, BrainCircuit, Clock, Sun, Plus, X, Save, List, RotateCcw } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from './Toast';

interface PlannerViewProps {
  tasks: Task[];
  userId: string;
}

const DEFAULT_TEMPLATES: PlanTemplate[] = [
  {
    id: 'deep-work',
    label: 'Deep Work',
    iconKey: 'brain',
    prompt: "I want to focus on Deep Work. Block out 2 hours of uninterrupted time in the morning for my most difficult task. No meetings before lunch."
  },
  {
    id: 'meeting-heavy',
    label: 'Meeting Heavy',
    iconKey: 'clock',
    prompt: "I have a lot of meetings today. Fit small administrative tasks (emails, quick calls) into the 15-30 minute gaps between events."
  },
  {
    id: 'catch-up',
    label: 'Admin Catch-up',
    iconKey: 'briefcase',
    prompt: "I need to clear my backlog. Prioritize clearing out small, low-effort tasks and responding to emails. Quantity over quality today."
  },
  {
    id: 'balanced',
    label: 'Balanced Flow',
    iconKey: 'sun',
    prompt: "Create a balanced schedule with 50 minutes of work followed by 10 minute breaks (Pomodoro style). End the day by 5:30 PM."
  }
];

export const PlannerView: React.FC<PlannerViewProps> = ({ tasks, userId }) => {
  const [notes, setNotes] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  
  // Custom Templates State
  const [customTemplates, setCustomTemplates] = useState<PlanTemplate[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Template Form State
  const [newLabel, setNewLabel] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [newIconKey, setNewIconKey] = useState<IconKey>('zap');

  const { addToast } = useToast();

  // Load data
  useEffect(() => {
    const fetchData = async () => {
        setIsLoadingData(true);
        try {
            const savedTemplates = await db.getCustomTemplates(userId);
            setCustomTemplates(savedTemplates);
            await loadPlanForDate(selectedDate);
        } catch(e) { console.error(e) }
        setIsLoadingData(false);
    }
    fetchData();
  }, [userId]);

  // When date changes, load plan
  useEffect(() => {
    loadPlanForDate(selectedDate);
  }, [selectedDate]);

  const loadPlanForDate = async (date: string) => {
    const savedPlan = await db.getDailyPlan(userId, date);
    if (savedPlan) {
      setSchedule(savedPlan.schedule);
      setNotes(savedPlan.notes);
    } else {
      setSchedule([]);
      setNotes('');
    }
  };

  const handleGenerate = async () => {
    if (!selectedDate) {
      addToast("Please select a date", "error");
      return;
    }
    setLoading(true);
    try {
      const planItems = await generateDailyPlan(tasks, notes, selectedDate);
      setSchedule(planItems);
      
      // Save to DB
      await db.saveDailyPlan({
        date: selectedDate,
        userId: userId,
        schedule: planItems,
        notes: notes
      });
      addToast("Schedule generated and saved", "success");

    } catch (error) {
      console.error(error);
      addToast("Failed to generate plan. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm("Are you sure you want to clear the current plan and notes?")) return;
    
    setLoading(true);
    try {
      setSchedule([]);
      setNotes('');
      
      // Save empty state to DB to persist the reset
      await db.saveDailyPlan({
        date: selectedDate,
        userId: userId,
        schedule: [],
        notes: ''
      });
      addToast("Plan reset successfully", "success");
    } catch (e) {
      addToast("Failed to reset plan", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCalendar = (item: ScheduleItem) => {
    const url = getScheduleCalendarUrl(item, selectedDate);
    if (url && url !== '#') {
      window.open(url, '_blank');
    } else {
      addToast("Could not parse time for calendar event.", "error");
    }
  };

  const saveCustomTemplate = async () => {
    if (!newLabel.trim() || !newPrompt.trim()) return;

    const newTemplate: PlanTemplate = {
      id: uuidv4(),
      userId: userId,
      label: newLabel,
      prompt: newPrompt,
      iconKey: newIconKey,
      isCustom: true
    };

    try {
        await db.addTemplate(newTemplate);
        const fresh = await db.getCustomTemplates(userId);
        setCustomTemplates(fresh);
        
        // Reset and close
        setNewLabel('');
        setNewPrompt('');
        setNewIconKey('zap');
        setIsModalOpen(false);
        addToast("Template saved", "success");
    } catch(e) {
        addToast("Failed to save template", "error");
    }
  };

  const deleteCustomTemplate = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
        await db.deleteTemplate(id);
        const fresh = await db.getCustomTemplates(userId);
        setCustomTemplates(fresh);
        addToast("Template removed", "success");
    } catch(e) {
        addToast("Failed to delete template", "error");
    }
  };

  // Helper to render icon based on key
  const renderIcon = (key: string, className = "w-4 h-4") => {
    switch (key) {
      case 'brain': return <BrainCircuit className={className} />;
      case 'clock': return <Clock className={className} />;
      case 'briefcase': return <Briefcase className={className} />;
      case 'sun': return <Sun className={className} />;
      case 'coffee': return <Coffee className={className} />;
      case 'zap': return <Zap className={className} />;
      case 'list': return <List className={className} />;
      default: return <Sparkles className={className} />;
    }
  };

  // Helper for schedule items
  const getScheduleIcon = (type: string) => {
    switch (type) {
      case 'break': return <Coffee className="w-5 h-5 text-silver" />;
      case 'focus': return <Zap className="w-5 h-5 text-strawberry" />;
      default: return <Briefcase className="w-5 h-5 text-mahogany" />;
    }
  };

  const allTemplates = [...DEFAULT_TEMPLATES, ...customTemplates];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Configuration Card */}
      <div className="bg-carbon border border-garnet/30 rounded-xl p-6 shadow-lg shadow-black/20">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-smoke flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-strawberry" />
              AI Daily Planner
            </h2>
            <p className="text-silver/70 text-sm mt-1">
              Configure your day and let AI optimize your schedule.
            </p>
          </div>
          
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Calendar className="w-4 h-4 text-strawberry" />
            </div>
            <input 
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="pl-9 pr-3 py-2 bg-onyx border border-garnet/40 rounded-lg text-sm text-smoke focus:border-strawberry outline-none [color-scheme:dark] shadow-sm cursor-pointer hover:border-strawberry/40 transition-colors"
            />
          </div>
        </div>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Describe how you want your day to look..."
          className="w-full bg-onyx text-smoke rounded-lg p-3 border border-garnet/40 focus:border-strawberry outline-none h-24 placeholder:text-silver/30 mb-4 resize-none transition-all"
        />

        {/* Quick Config Templates */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-silver/50 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Zap className="w-3 h-3" />
            Quick Configurations
          </p>
          <div className="flex flex-wrap gap-2">
            {allTemplates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setNotes(t.prompt)}
                className="group flex items-center gap-2 px-3 py-1.5 rounded-full bg-onyx border border-garnet/30 text-xs text-silver hover:text-smoke hover:border-strawberry/50 hover:bg-garnet/10 transition-all active:scale-95 relative"
              >
                {renderIcon(t.iconKey, "w-3.5 h-3.5")}
                {t.label}
                {t.isCustom && (
                  <span 
                    onClick={(e) => deleteCustomTemplate(e, t.id)}
                    className="ml-1 p-0.5 rounded-full hover:bg-garnet/40 text-silver/50 hover:text-strawberry transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </span>
                )}
              </button>
            ))}
            
            {/* Add Button */}
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-onyx border border-dashed border-garnet/40 text-xs text-strawberry hover:bg-garnet/10 hover:border-strawberry transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Add New
            </button>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-garnet/20 gap-3">
          <button
            type="button"
            onClick={handleReset}
            disabled={loading || (!notes && schedule.length === 0)}
            className="px-4 py-2.5 rounded-lg font-medium text-silver hover:text-strawberry hover:bg-garnet/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-transparent hover:border-strawberry/30 flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="hidden sm:inline">Reset</span>
          </button>
          
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="bg-mahogany hover:bg-ruby disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-all shadow-lg shadow-black/20"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Optimizing Schedule...
              </>
            ) : (
              <>
                Generate Schedule
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results Section */}
      {schedule.length > 0 && (
        <div className="bg-carbon border border-garnet/30 rounded-xl p-6 shadow-lg shadow-black/20 relative overflow-hidden">
          {/* Decorative background element */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-strawberry/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2"></div>

          <div className="flex items-center justify-between mb-6 relative z-10">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-smoke">Your Schedule</h3>
              <span className="text-sm text-silver/60 font-mono bg-onyx px-2 py-0.5 rounded border border-garnet/20">
                {new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
            </div>
          </div>

          <div className="relative space-y-0 z-10">
            {/* Timeline Vertical Line */}
            <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-garnet/30"></div>

            {schedule.map((item, index) => (
              <div key={index} className="relative flex gap-4 group hover:bg-onyx/40 p-3 rounded-lg transition-colors">
                <div className="relative z-10 flex flex-col items-center">
                   <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0 bg-carbon ${
                     item.type === 'break' ? 'border-silver/30' : 
                     item.type === 'focus' ? 'border-strawberry' : 'border-garnet'
                   }`}>
                      {getScheduleIcon(item.type)}
                   </div>
                </div>
                
                <div className="flex-1 pt-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 mb-1">
                    <span className="font-bold text-smoke text-base truncate">{item.activity}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-mono text-strawberry/80 bg-strawberry/10 px-2 py-0.5 rounded border border-strawberry/20">
                        {item.time}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAddToCalendar(item)}
                        className="text-silver hover:text-strawberry transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="Add to Calendar"
                      >
                        <Plus className="w-4 h-4 border border-current rounded p-0.5" />
                      </button>
                    </div>
                  </div>
                  {item.notes && (
                    <p className="text-sm text-silver/70 group-hover:text-silver transition-colors">
                      {item.notes}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add New Template Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-carbon border border-garnet/30 rounded-xl shadow-2xl w-full max-w-md p-6 relative">
            <button 
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-silver hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-smoke mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-strawberry" />
              Add Quick Configuration
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-silver block mb-1.5">Label</label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g., Creative Writing"
                  className="w-full bg-onyx text-smoke rounded-lg px-3 py-2 border border-garnet/40 focus:border-strawberry outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-medium text-silver block mb-1.5">Prompt Text (The context for AI)</label>
                <textarea
                  value={newPrompt}
                  onChange={(e) => setNewPrompt(e.target.value)}
                  placeholder="e.g., Schedule 3 hours of writing time in the afternoon..."
                  className="w-full bg-onyx text-smoke rounded-lg px-3 py-2 border border-garnet/40 focus:border-strawberry outline-none h-20 resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-silver block mb-1.5">Icon</label>
                <div className="flex gap-2 bg-onyx p-2 rounded-lg border border-garnet/20">
                  {(['zap', 'brain', 'clock', 'briefcase', 'coffee', 'sun', 'list'] as IconKey[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setNewIconKey(key)}
                      className={`p-2 rounded-md transition-all ${
                        newIconKey === key 
                          ? 'bg-mahogany text-white shadow-lg' 
                          : 'text-silver hover:text-smoke hover:bg-carbon'
                      }`}
                    >
                      {renderIcon(key, "w-4 h-4")}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-garnet/20">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-silver hover:text-white hover:bg-garnet/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveCustomTemplate}
                disabled={!newLabel.trim() || !newPrompt.trim()}
                className="bg-mahogany hover:bg-ruby disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all shadow-md"
              >
                <Save className="w-4 h-4" />
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};