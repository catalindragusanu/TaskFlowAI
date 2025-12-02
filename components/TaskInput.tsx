import React, { useState, useRef } from 'react';
import { Mic, Send, Loader2, Sparkles, Calendar, X, Plus, Edit3 } from 'lucide-react';
import { parseTaskFromInput } from '../services/geminiService';
import { ParsedTaskResponse, TaskStatus, Priority } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from './Toast';

interface TaskInputProps {
  onTaskCreate: (task: any) => void;
}

export const TaskInput: React.FC<TaskInputProps> = ({ onTaskCreate }) => {
  const [mode, setMode] = useState<'ai' | 'manual'>('ai');
  const { addToast } = useToast();

  // AI Mode State
  const [input, setInput] = useState('');
  const [manualDateOverride, setManualDateOverride] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Manual Mode State
  const [manualTitle, setManualTitle] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [manualDate, setManualDate] = useState('');
  const [manualPriority, setManualPriority] = useState<Priority>(Priority.MEDIUM);

  const handleSmartAdd = async () => {
    if (!input.trim()) return;

    setIsProcessing(true);
    try {
      const parsedData: ParsedTaskResponse = await parseTaskFromInput(input);
      
      // Override date if manually set in AI mode
      const finalDueDate = manualDateOverride 
        ? new Date(manualDateOverride).toISOString() 
        : parsedData.dueDate;

      const newTask = {
        id: uuidv4(),
        ...parsedData,
        dueDate: finalDueDate,
        status: TaskStatus.TODO,
        createdAt: new Date().toISOString(),
      };

      onTaskCreate(newTask);
      setInput('');
      setManualDateOverride('');
    } catch (error) {
      console.error("Error parsing task:", error);
      addToast("Could not understand the task. Please try again.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualAdd = () => {
    if (!manualTitle.trim()) {
      addToast("Task title is required.", "error");
      return;
    }
    if (!manualDate) {
      addToast("Due date is required.", "error");
      return;
    }

    const newTask = {
      id: uuidv4(),
      title: manualTitle,
      description: manualDesc,
      dueDate: new Date(manualDate).toISOString(),
      priority: manualPriority,
      status: TaskStatus.TODO,
      createdAt: new Date().toISOString(),
    };

    onTaskCreate(newTask);
    
    // Reset form
    setManualTitle('');
    setManualDesc('');
    setManualDate('');
    setManualPriority(Priority.MEDIUM);
  };

  const toggleListening = () => {
    // Cross-browser support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      addToast("Speech recognition is not supported in this browser.", "error");
      return;
    }

    if (isListening) {
      setIsListening(false);
    } else {
      setIsListening(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput((prev) => prev + (prev ? ' ' : '') + transcript);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    }
  };

  return (
    <div className="bg-carbon p-4 rounded-xl shadow-lg border border-garnet/30 mb-8 backdrop-blur-sm">
      
      {/* Mode Switcher */}
      <div className="flex items-center gap-4 mb-4 border-b border-garnet/30 pb-2">
        <button
          onClick={() => setMode('ai')}
          className={`text-sm font-medium flex items-center gap-2 pb-2 transition-all relative ${
            mode === 'ai' ? 'text-smoke' : 'text-silver/50 hover:text-silver'
          }`}
        >
          <Sparkles className={`w-4 h-4 ${mode === 'ai' ? 'text-strawberry' : ''}`} />
          AI Quick Add
          {mode === 'ai' && <div className="absolute bottom-[-9px] left-0 w-full h-0.5 bg-strawberry rounded-t-full" />}
        </button>
        <button
          onClick={() => setMode('manual')}
          className={`text-sm font-medium flex items-center gap-2 pb-2 transition-all relative ${
            mode === 'manual' ? 'text-smoke' : 'text-silver/50 hover:text-silver'
          }`}
        >
          <Edit3 className={`w-4 h-4 ${mode === 'manual' ? 'text-strawberry' : ''}`} />
          Manual Entry
          {mode === 'manual' && <div className="absolute bottom-[-9px] left-0 w-full h-0.5 bg-strawberry rounded-t-full" />}
        </button>
      </div>

      {mode === 'ai' ? (
        // AI MODE UI
        <div className="flex flex-col gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g., 'Submit quarterly report next Tuesday at 2 PM high priority'"
            className="w-full bg-onyx text-smoke rounded-lg p-3 border border-garnet/40 focus:border-strawberry focus:ring-1 focus:ring-strawberry outline-none resize-none h-24 transition-all placeholder:text-silver/30"
            disabled={isProcessing}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSmartAdd();
              }
            }}
          />
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                onClick={toggleListening}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors border border-transparent ${
                  isListening 
                    ? 'bg-strawberry/10 text-strawberry border-strawberry/20' 
                    : 'text-silver hover:text-smoke hover:bg-garnet/20'
                }`}
              >
                <Mic className={`w-4 h-4 ${isListening ? 'animate-pulse' : ''}`} />
                <span className="hidden xs:inline">{isListening ? 'Listening...' : 'Voice'}</span>
              </button>

              <div className="h-4 w-px bg-garnet/40 mx-1 hidden sm:block"></div>

              <div className="relative flex items-center group">
                <div className="absolute left-2.5 pointer-events-none">
                  <Calendar className={`w-4 h-4 ${manualDateOverride ? 'text-strawberry' : 'text-silver/60'}`} />
                </div>
                <input 
                  type="datetime-local"
                  value={manualDateOverride}
                  onChange={(e) => setManualDateOverride(e.target.value)}
                  className={`
                    pl-9 pr-2 py-1.5 rounded-lg text-xs sm:text-sm bg-onyx border outline-none transition-all
                    [color-scheme:dark]
                    ${manualDateOverride 
                      ? 'border-strawberry/50 text-smoke shadow-[0_0_10px_-3px_rgba(229,56,59,0.3)]' 
                      : 'border-garnet/40 text-silver/60 hover:border-strawberry/30'
                    }
                  `}
                />
                {manualDateOverride && (
                  <button 
                    onClick={() => setManualDateOverride('')}
                    className="absolute -right-2 -top-2 bg-onyx border border-garnet rounded-full p-0.5 text-strawberry hover:text-white shadow-sm"
                    title="Clear date override"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={handleSmartAdd}
              disabled={!input.trim() || isProcessing}
              className="w-full sm:w-auto bg-mahogany hover:bg-ruby disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-all shadow-lg shadow-black/20"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Thinking...
                </>
              ) : (
                <>
                  Create Task
                  <Send className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        // MANUAL MODE UI
        <div className="flex flex-col gap-3">
          <input
            type="text"
            value={manualTitle}
            onChange={(e) => setManualTitle(e.target.value)}
            placeholder="Task Title (Required)"
            className="w-full bg-onyx text-smoke rounded-lg px-3 py-2 border border-garnet/40 focus:border-strawberry outline-none placeholder:text-silver/30"
          />
          
          <textarea
            value={manualDesc}
            onChange={(e) => setManualDesc(e.target.value)}
            placeholder="Description (Optional)"
            className="w-full bg-onyx text-smoke rounded-lg px-3 py-2 border border-garnet/40 focus:border-strawberry outline-none resize-none h-20 placeholder:text-silver/30"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
               <label className="text-xs text-silver/70 ml-1 mb-1 block">Due Date</label>
               <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-silver/60 pointer-events-none" />
                  <input
                    type="datetime-local"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="w-full bg-onyx text-smoke rounded-lg pl-9 pr-3 py-2 border border-garnet/40 focus:border-strawberry outline-none [color-scheme:dark]"
                  />
               </div>
            </div>

            <div>
              <label className="text-xs text-silver/70 ml-1 mb-1 block">Priority</label>
              <select
                value={manualPriority}
                onChange={(e) => setManualPriority(e.target.value as Priority)}
                className="w-full bg-onyx text-smoke rounded-lg px-3 py-2 border border-garnet/40 focus:border-strawberry outline-none appearance-none"
              >
                <option value={Priority.LOW}>Low</option>
                <option value={Priority.MEDIUM}>Medium</option>
                <option value={Priority.HIGH}>High</option>
                <option value={Priority.URGENT}>Urgent</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end mt-2">
            <button
              onClick={handleManualAdd}
              disabled={!manualTitle.trim() || !manualDate}
              className="w-full sm:w-auto bg-mahogany hover:bg-ruby disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-all shadow-lg shadow-black/20"
            >
              Add Task
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};