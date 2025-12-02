import React, { useState } from 'react';
import { Task, Priority, TaskStatus, Subtask } from '../types';
import { Calendar, Mail, CheckCircle2, Circle, Trash2, ExternalLink, Loader2, Clock, Split, CheckSquare, Edit2, Save, X, Plus } from 'lucide-react';
import { formatDate, getGoogleCalendarUrl, getMailtoLink } from '../utils/dateUtils';
import { generateReminderEmail, breakDownTask } from '../services/geminiService';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from './Toast';

interface TaskItemProps {
  task: Task;
  onUpdate: (task: Task) => void;
  onDelete: (id: string) => void;
  recipients: string; // Comma separated emails
}

export const TaskItem: React.FC<TaskItemProps> = ({ task, onUpdate, onDelete, recipients }) => {
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);
  const [isBreakingDown, setIsBreakingDown] = useState(false);
  const { addToast } = useToast();
  
  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDesc, setEditDesc] = useState(task.description);
  const [editDate, setEditDate] = useState(task.dueDate);
  const [editPriority, setEditPriority] = useState(task.priority);

  // Manual Subtask State
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // New Priority colors for the Red/Black theme
  const priorityColors = {
    [Priority.LOW]: 'bg-carbon text-silver border-silver/30',
    [Priority.MEDIUM]: 'bg-carbon text-dust border-strawberry/30',
    [Priority.HIGH]: 'bg-garnet/30 text-strawberry border-strawberry',
    [Priority.URGENT]: 'bg-mahogany text-white border-ruby',
  };

  const handleStatusChange = () => {
    onUpdate({
      ...task,
      status: task.status === TaskStatus.COMPLETED ? TaskStatus.TODO : TaskStatus.COMPLETED
    });
  };

  const handleSaveEdit = () => {
    onUpdate({
      ...task,
      title: editTitle,
      description: editDesc,
      dueDate: editDate,
      priority: editPriority
    });
    setIsEditing(false);
    addToast("Task updated", "success");
  };

  const handleCancelEdit = () => {
    setEditTitle(task.title);
    setEditDesc(task.description);
    setEditDate(task.dueDate);
    setEditPriority(task.priority);
    setIsEditing(false);
  };

  const handleCalendarClick = () => {
    const url = getGoogleCalendarUrl(task);
    window.open(url, '_blank');
  };

  const handleEmailClick = async () => {
    if (!recipients) {
      addToast("Please add and select at least one email address at the top.", "error");
      return;
    }

    setIsGeneratingEmail(true);
    try {
      const emailContent = await generateReminderEmail(task.title, task.dueDate, task.priority);
      const mailto = getMailtoLink(recipients, emailContent.subject, emailContent.body);
      window.location.href = mailto;
      addToast("Email draft opened", "success");
    } catch (e) {
      console.error(e);
      addToast("Failed to generate email draft.", "error");
    } finally {
      setIsGeneratingEmail(false);
    }
  };

  const handleBreakdown = async () => {
    setIsBreakingDown(true);
    try {
      const steps = await breakDownTask(task.title, task.description);
      const newSubtasks = steps.map(step => ({
        id: uuidv4(),
        title: step,
        isCompleted: false
      }));

      onUpdate({
        ...task,
        subtasks: [...(task.subtasks || []), ...newSubtasks]
      });
      addToast("Subtasks generated", "success");
    } catch (e) {
      console.error(e);
      addToast("Could not break down task.", "error");
    } finally {
      setIsBreakingDown(false);
    }
  };

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    const newSubtask: Subtask = {
        id: uuidv4(),
        title: newSubtaskTitle,
        isCompleted: false
    };
    onUpdate({
        ...task,
        subtasks: [...(task.subtasks || []), newSubtask]
    });
    setNewSubtaskTitle('');
  };

  const toggleSubtask = (subtaskId: string) => {
    if (!task.subtasks) return;
    
    const updatedSubtasks = task.subtasks.map(st => 
      st.id === subtaskId ? { ...st, isCompleted: !st.isCompleted } : st
    );
    
    onUpdate({ ...task, subtasks: updatedSubtasks });
  };

  const deleteSubtask = (subtaskId: string) => {
    if (!task.subtasks) return;
    const updatedSubtasks = task.subtasks.filter(st => st.id !== subtaskId);
    onUpdate({ ...task, subtasks: updatedSubtasks });
  };

  if (isEditing) {
    return (
        <div className="bg-carbon rounded-xl border border-strawberry/50 shadow-[0_0_15px_-5px_rgba(164,22,26,0.3)] p-4 transition-all">
            <div className="flex flex-col gap-3">
                <input 
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="bg-onyx text-smoke font-semibold text-lg p-2 rounded border border-garnet/40 focus:border-strawberry outline-none"
                    placeholder="Task Title"
                />
                <textarea 
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="bg-onyx text-silver text-sm p-2 rounded border border-garnet/40 focus:border-strawberry outline-none resize-none h-20"
                    placeholder="Description"
                />
                <div className="grid grid-cols-2 gap-3">
                    <input 
                        type="datetime-local"
                        value={editDate.substring(0, 16)} // Format for input
                        onChange={(e) => setEditDate(new Date(e.target.value).toISOString())}
                        className="bg-onyx text-silver text-xs p-2 rounded border border-garnet/40 focus:border-strawberry outline-none [color-scheme:dark]"
                    />
                    <select
                        value={editPriority}
                        onChange={(e) => setEditPriority(e.target.value as Priority)}
                        className="bg-onyx text-silver text-xs p-2 rounded border border-garnet/40 focus:border-strawberry outline-none"
                    >
                         {Object.values(Priority).map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>
                <div className="flex justify-end gap-2 mt-2">
                    <button onClick={handleCancelEdit} className="p-2 text-silver hover:text-white hover:bg-garnet/20 rounded">
                        <X className="w-4 h-4" />
                    </button>
                    <button onClick={handleSaveEdit} className="flex items-center gap-1 px-3 py-1.5 bg-mahogany text-white rounded hover:bg-ruby shadow-md">
                        <Save className="w-4 h-4" /> Save
                    </button>
                </div>
            </div>
        </div>
    )
  }

  return (
    <div className={`group bg-carbon rounded-xl border transition-all hover:border-strawberry/40 ${
      task.status === TaskStatus.COMPLETED ? 'border-garnet/20 opacity-60' : 'border-garnet/40'
    }`}>
      <div className="p-4">
        <div className="flex items-start gap-4">
          <button
            onClick={handleStatusChange}
            className="mt-1 text-silver hover:text-strawberry transition-colors shrink-0"
          >
            {task.status === TaskStatus.COMPLETED ? (
              <CheckCircle2 className="w-6 h-6 text-strawberry" />
            ) : (
              <Circle className="w-6 h-6" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className={`font-semibold text-lg leading-tight truncate pr-4 ${
                task.status === TaskStatus.COMPLETED ? 'line-through text-silver/50' : 'text-smoke'
              }`}>
                {task.title}
              </h3>
              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border tracking-wide ${priorityColors[task.priority]}`}>
                {task.priority}
              </span>
            </div>

            <p className={`text-sm mt-1 mb-3 ${
              task.status === TaskStatus.COMPLETED ? 'text-silver/50' : 'text-silver'
            }`}>
              {task.description}
            </p>

            {/* Subtasks Section */}
            {(task.subtasks?.length || 0) > 0 || isBreakingDown ? (
              <div className="mb-4 space-y-2 bg-onyx/50 p-3 rounded-lg border border-garnet/30">
                <p className="text-xs font-medium text-silver/70 mb-2 flex justify-between">
                    <span>Steps:</span>
                    <span className="text-[10px]">{task.subtasks?.filter(t => t.isCompleted).length}/{task.subtasks?.length}</span>
                </p>
                
                {task.subtasks?.map(st => (
                  <div key={st.id} className="flex items-center gap-2 text-sm text-silver group/sub">
                     <button onClick={() => toggleSubtask(st.id)} className="hover:text-smoke transition-colors shrink-0">
                        {st.isCompleted ? (
                          <CheckSquare className="w-4 h-4 text-strawberry" />
                        ) : (
                          <div className="w-4 h-4 border-2 border-silver/50 rounded-[3px]" />
                        )}
                     </button>
                     <span className={`flex-1 truncate ${st.isCompleted ? 'line-through text-silver/50' : ''}`}>{st.title}</span>
                     <button onClick={() => deleteSubtask(st.id)} className="opacity-0 group-hover/sub:opacity-100 text-silver/40 hover:text-strawberry transition-all">
                        <X className="w-3.5 h-3.5" />
                     </button>
                  </div>
                ))}

                {/* Manual Subtask Add */}
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-garnet/20">
                    <Plus className="w-3.5 h-3.5 text-silver/50" />
                    <input 
                        type="text"
                        value={newSubtaskTitle}
                        onChange={(e) => setNewSubtaskTitle(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
                        placeholder="Add a step..."
                        className="bg-transparent text-sm text-silver placeholder:text-silver/30 outline-none flex-1 min-w-0"
                    />
                    {newSubtaskTitle && (
                        <button onClick={handleAddSubtask} className="text-xs text-strawberry hover:text-white px-2 py-0.5 bg-garnet/20 rounded">
                            Add
                        </button>
                    )}
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 text-xs text-silver/60 pt-2 border-t border-garnet/30">
              <div className="flex items-center gap-1.5 text-strawberry mr-2">
                <Clock className="w-3.5 h-3.5" />
                <span>Due: {formatDate(task.dueDate)}</span>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                
                {/* Break Down Action */}
                {!task.subtasks?.length && task.status !== TaskStatus.COMPLETED && (
                  <button
                    onClick={handleBreakdown}
                    disabled={isBreakingDown}
                    className="flex items-center gap-1.5 px-2 py-1.5 bg-onyx hover:bg-garnet/20 text-silver hover:text-smoke rounded transition-colors"
                    title="Break down into steps with AI"
                  >
                    {isBreakingDown ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Split className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden sm:inline">Break Down</span>
                  </button>
                )}

                {/* Calendar Action */}
                <button
                  onClick={handleCalendarClick}
                  className="flex items-center gap-1.5 px-2 py-1.5 bg-onyx hover:bg-garnet/20 text-silver hover:text-smoke rounded transition-colors"
                  title="Add to Google Calendar"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Calendar</span>
                  <ExternalLink className="w-3 h-3 opacity-50" />
                </button>

                {/* Email Action */}
                <button
                  onClick={handleEmailClick}
                  disabled={isGeneratingEmail}
                  className="flex items-center gap-1.5 px-2 py-1.5 bg-onyx hover:bg-garnet/20 text-silver hover:text-smoke rounded transition-colors disabled:opacity-50"
                  title="Draft Email Reminder"
                >
                  {isGeneratingEmail ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Mail className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">Draft</span>
                </button>

                {/* Edit Action */}
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1.5 text-silver hover:text-white hover:bg-garnet/20 rounded transition-colors"
                  title="Edit Task"
                >
                  <Edit2 className="w-4 h-4" />
                </button>

                <button
                  onClick={() => onDelete(task.id)}
                  className="p-1.5 text-silver hover:text-strawberry hover:bg-garnet/20 rounded transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};