import React, { useState, useRef } from 'react';
import { Mic, Send, Loader2, Sparkles, Calendar, X, Plus, Edit3, Lightbulb, Paperclip, FileText } from 'lucide-react';
import { parseTaskFromInput, brainstormGoal } from '../services/geminiService';
import { ParsedTaskResponse, TaskStatus, Priority, Mood } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from './Toast';

interface TaskInputProps {
  onTaskCreate: (task: any) => void;
  userMood: Mood;
}

export const TaskInput: React.FC<TaskInputProps> = ({ onTaskCreate, userMood }) => {
  const [mode, setMode] = useState<'ai' | 'brainstorm' | 'manual'>('ai');
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inputs
  const [input, setInput] = useState('');
  const [manualDateOverride, setManualDateOverride] = useState('');
  
  // Processing States
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  // File State
  const [selectedFile, setSelectedFile] = useState<{name: string, type: string} | null>(null);

  // Manual Mode State
  const [manualTitle, setManualTitle] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [manualDate, setManualDate] = useState('');
  const [manualPriority, setManualPriority] = useState<Priority>(Priority.MEDIUM);

  const validateDate = (dateStr: string): string => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
        // Fallback to tomorrow if AI returns invalid date
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString();
    }
    return d.toISOString();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile({
        name: file.name,
        type: file.type || 'application/octet-stream' // fallback
      });
      addToast(`Attached: ${file.name}`, "info");
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Helper to construct attachment object
  const getAttachments = () => {
    return selectedFile ? [{
        id: uuidv4(),
        name: selectedFile.name,
        type: selectedFile.type.includes('image') ? 'image' : 'pdf', // Simple mapping
        url: '#' // No backend upload in this demo
    }] : [];
  };

  const handleSmartAdd = async () => {
    if (!input.trim()) return;

    setIsProcessing(true);
    try {
      if (mode === 'brainstorm') {
        const tasks = await brainstormGoal(input, userMood);
        if (!tasks || tasks.length === 0) {
            addToast("Could not generate tasks. Try providing more detail.", "error");
        } else {
            // Bug fix: Ensure attachments are added to brainstormed tasks too
            const currentAttachments = getAttachments();
            tasks.forEach(t => {
                onTaskCreate({
                    id: uuidv4(),
                    ...t,
                    dueDate: validateDate(t.dueDate),
                    status: TaskStatus.TODO,
                    createdAt: new Date().toISOString(),
                    attachments: currentAttachments
                });
            });
            addToast(`Created ${tasks.length} tasks from your goal!`, "success");
        }
      } else {
        // Normal AI Parse
        const parsedData: ParsedTaskResponse = await parseTaskFromInput(input, userMood);
        
        const finalDueDate = manualDateOverride 
            ? new Date(manualDateOverride).toISOString() 
            : validateDate(parsedData.dueDate);

        onTaskCreate({
            id: uuidv4(),
            ...parsedData,
            dueDate: finalDueDate,
            priority: (parsedData.priority as string).toUpperCase() as Priority,
            status: TaskStatus.TODO,
            createdAt: new Date().toISOString(),
            attachments: getAttachments()
        });
        addToast("Task created", "success");
      }
      
      setInput('');
      setManualDateOverride('');
      clearFile();
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

    onTaskCreate({
      id: uuidv4(),
      title: manualTitle,
      description: manualDesc,
      dueDate: new Date(manualDate).toISOString(),
      priority: manualPriority,
      status: TaskStatus.TODO,
      createdAt: new Date().toISOString(),
      attachments: getAttachments()
    });
    
    setManualTitle('');
    setManualDesc('');
    setManualDate('');
    setManualPriority(Priority.MEDIUM);
    clearFile();
    addToast("Task added successfully", "success");
  };

  const toggleListening = () => {
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
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    }
  };

  return (
    <div className="bg-carbon p-4 rounded-xl shadow-lg border border-garnet/30 mb-8 backdrop-blur-sm transition-all duration-300">
      
      {/* Hidden File Input */}
      <input 
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        onClick={(e) => { (e.target as HTMLInputElement).value = '' }} // Ensure onChange fires even for same file
        className="hidden"
      />

      {/* Mode Switcher */}
      <div className="flex items-center gap-6 mb-4 border-b border-garnet/30">
        {[
            { id: 'ai', label: 'Quick Add', icon: Sparkles },
            { id: 'brainstorm', label: 'Brainstorm', icon: Lightbulb },
            { id: 'manual', label: 'Manual', icon: Edit3 }
        ].map((m) => (
            <button
                key={m.id}
                onClick={() => setMode(m.id as any)}
                className={`text-sm font-medium flex items-center gap-2 pb-3 transition-all relative ${
                    mode === m.id ? 'text-smoke' : 'text-silver/50 hover:text-silver'
                }`}
            >
                <m.icon className={`w-4 h-4 ${mode === m.id ? 'text-strawberry' : ''}`} />
                {m.label}
                {mode === m.id && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-strawberry rounded-t-full" />}
            </button>
        ))}
      </div>

      {/* Shared Attachment Badge - Visible in ALL modes */}
      {selectedFile && (
        <div className="mb-3 animate-in fade-in slide-in-from-top-1">
             <div className="inline-flex items-center gap-2 bg-garnet/20 text-strawberry text-xs px-3 py-1.5 rounded-lg border border-garnet/40">
                <Paperclip className="w-3.5 h-3.5" /> 
                <span className="font-medium">{selectedFile.name}</span>
                <span className="text-silver/50 text-[10px]">({selectedFile.type.split('/')[1] || 'file'})</span>
                <button 
                    onClick={clearFile} 
                    className="ml-2 hover:text-white p-0.5 rounded-full hover:bg-garnet/30 transition-colors"
                    title="Remove attachment"
                >
                    <X className="w-3 h-3"/>
                </button>
            </div>
        </div>
      )}

      {mode !== 'manual' ? (
        // AI & BRAINSTORM MODE UI
        <div className="flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-200">
          <div className="relative">
            <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={mode === 'brainstorm' 
                    ? "e.g., 'Launch my personal website by next month' or 'Plan a team offsite'" 
                    : "e.g., 'Finish the report by Friday urgent #work'"}
                className="w-full bg-onyx text-smoke rounded-lg p-3 border border-garnet/40 focus:border-strawberry focus:ring-1 focus:ring-strawberry outline-none resize-none h-24 transition-all placeholder:text-silver/30"
                disabled={isProcessing}
                onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSmartAdd();
                }
                }}
            />
          </div>
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                onClick={toggleListening}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors border border-transparent ${
                  isListening 
                    ? 'bg-strawberry/10 text-strawberry border-strawberry/20' 
                    : 'text-silver hover:text-smoke hover:bg-garnet/20'
                }`}
                title="Voice Input"
              >
                <Mic className={`w-4 h-4 ${isListening ? 'animate-pulse' : ''}`} />
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors border border-transparent ${
                  selectedFile 
                    ? 'text-strawberry bg-garnet/10' 
                    : 'text-silver hover:text-smoke hover:bg-garnet/20'
                }`}
                title="Attach File"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              {mode === 'ai' && (
                  <>
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
                    </div>
                  </>
              )}
            </div>

            <button
              onClick={handleSmartAdd}
              disabled={!input.trim() || isProcessing}
              className="w-full sm:w-auto bg-mahogany hover:bg-ruby disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-all shadow-lg shadow-black/20"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {mode === 'brainstorm' ? 'Brainstorming...' : 'Processing...'}
                </>
              ) : (
                <>
                  {mode === 'brainstorm' ? 'Generate Plan' : 'Create Task'}
                  {mode === 'brainstorm' ? <Lightbulb className="w-4 h-4"/> : <Send className="w-4 h-4" />}
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        // MANUAL MODE UI
        <div className="flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-200">
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

          <div className="flex justify-between items-center mt-2">
            {/* Added File Attachment Button for Manual Mode */}
            <button
                onClick={() => fileInputRef.current?.click()}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors border border-transparent ${
                  selectedFile 
                    ? 'text-strawberry bg-garnet/10' 
                    : 'text-silver hover:text-smoke hover:bg-garnet/20'
                }`}
                title="Attach File"
            >
                <Paperclip className="w-4 h-4" />
                <span className="hidden sm:inline">Attach File</span>
            </button>

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