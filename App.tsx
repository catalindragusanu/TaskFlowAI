import React, { useState, useEffect } from 'react';
import { TaskInput } from './components/TaskInput';
import { TaskItem } from './components/TaskItem';
import { PlannerView } from './components/PlannerView';
import { Task, EmailContact } from './types';
import { Layout, Calendar as CalendarIcon, Info, Sparkles, Loader2, Mail, CheckCircle2, Plus, Trash2, Users, ListTodo, CalendarClock, XCircle } from 'lucide-react';
import { generateDailyBriefing } from './services/geminiService';
import { getMailtoLink } from './utils/dateUtils';
import { v4 as uuidv4 } from 'uuid';
import { db } from './services/databaseService';
import { useToast } from './components/Toast';
import { Confetti } from './components/Confetti';

type ViewMode = 'tasks' | 'planner';

const GUEST_ID = 'guest-user';

const App: React.FC = () => {
  const [view, setView] = useState<ViewMode>('tasks');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [emailContacts, setEmailContacts] = useState<EmailContact[]>([]);
  const [newEmailAddress, setNewEmailAddress] = useState('');
  const [isBriefingLoading, setIsBriefingLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false);
  
  // Search, Progress, and Rewards
  const [searchQuery, setSearchQuery] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);
  const { addToast } = useToast();

  // Load Data Immediately on Mount
  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    setIsDataLoading(true);
    try {
      const [fetchedTasks, fetchedContacts] = await Promise.all([
        db.getTasks(GUEST_ID),
        db.getContacts(GUEST_ID)
      ]);
      setTasks(fetchedTasks);
      setEmailContacts(fetchedContacts);
    } catch (e) {
      console.error(e);
      addToast('Failed to load data', 'error');
    } finally {
      setIsDataLoading(false);
    }
  };

  const addTask = async (taskData: any) => {
    const newTask: Task = { ...taskData, userId: GUEST_ID };
    
    // Optimistic update
    setTasks(prev => [newTask, ...prev]);
    
    try {
      await db.addTask(newTask);
      addToast('Task created successfully', 'success');
    } catch (e) {
      console.error(e);
      addToast('Failed to save task', 'error');
      loadUserData();
    }
  };

  const deleteTask = async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id)); // Optimistic
    try {
      await db.deleteTask(id);
      addToast('Task deleted', 'success');
    } catch (e) {
       loadUserData();
    }
  };

  const clearCompletedTasks = async () => {
    if (window.confirm("Are you sure you want to remove all completed tasks?")) {
        try {
          await db.clearCompletedTasks(GUEST_ID);
          const freshTasks = await db.getTasks(GUEST_ID);
          setTasks(freshTasks);
          addToast('Completed tasks cleared', 'success');
        } catch (e) {
          addToast('Failed to clear tasks', 'error');
        }
    }
  };

  const updateTask = async (updatedTask: Task) => {
    // Check if task just got completed to trigger confetti
    const prevTask = tasks.find(t => t.id === updatedTask.id);
    if (prevTask && prevTask.status !== 'COMPLETED' && updatedTask.status === 'COMPLETED') {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2000);
      addToast("Great job!", "success");
    }

    setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t)); // Optimistic
    try {
      await db.updateTask(updatedTask);
    } catch (e) {
      loadUserData();
    }
  };

  // Email Management Logic
  const addEmail = async () => {
    if (!newEmailAddress || !newEmailAddress.includes('@')) return;
    
    const newContact: EmailContact = { 
        id: uuidv4(), 
        userId: GUEST_ID,
        address: newEmailAddress.trim(), 
        isActive: true 
    };
    
    try {
      await db.addContact(newContact);
      const freshContacts = await db.getContacts(GUEST_ID);
      setEmailContacts(freshContacts);
      setNewEmailAddress('');
      addToast('Email contact added', 'success');
    } catch (e) {
      addToast('Failed to add email', 'error');
    }
  };

  const deleteEmail = async (id: string) => {
    try {
      await db.deleteContact(id);
      const freshContacts = await db.getContacts(GUEST_ID);
      setEmailContacts(freshContacts);
      addToast('Email contact removed', 'success');
    } catch (e) {
       addToast('Failed to remove email', 'error');
    }
  };

  const toggleEmailActive = async (id: string) => {
    const contact = emailContacts.find(c => c.id === id);
    if (contact) {
        const updated = { ...contact, isActive: !contact.isActive };
        try {
          await db.updateContact(updated);
          const freshContacts = await db.getContacts(GUEST_ID);
          setEmailContacts(freshContacts);
        } catch(e) { console.error(e); }
    }
  };

  const getActiveRecipients = () => {
    return emailContacts.filter(c => c.isActive).map(c => c.address).join(',');
  };

  const handleDailyBriefing = async () => {
    const recipients = getActiveRecipients();
    if (!recipients) {
      addToast("Please add an active email address first.", "error");
      return;
    }
    
    setIsBriefingLoading(true);
    try {
      const emailContent = await generateDailyBriefing(tasks);
      const mailto = getMailtoLink(recipients, emailContent.subject, emailContent.body);
      window.location.href = mailto;
      addToast('Briefing generated!', 'success');
    } catch (e) {
      console.error(e);
      addToast("Failed to generate briefing.", "error");
    } finally {
      setIsBriefingLoading(false);
    }
  };

  // Group tasks logic
  const groupTasks = () => {
    const now = new Date();
    const todayStr = now.toDateString();
    
    const overdue: Task[] = [];
    const today: Task[] = [];
    const upcoming: Task[] = [];
    const completed: Task[] = [];

    // Filter by search query
    const filteredTasks = tasks.filter(t => 
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      t.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    filteredTasks.forEach(task => {
      if (task.status === 'COMPLETED') {
        completed.push(task);
        return;
      }
      
      const dueDate = new Date(task.dueDate);
      
      if (dueDate < now && dueDate.toDateString() !== todayStr) {
        overdue.push(task);
      } else if (dueDate.toDateString() === todayStr) {
        today.push(task);
      } else {
        upcoming.push(task);
      }
    });

    // Sort by date inside groups
    const sorter = (a: Task, b: Task) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    
    return {
      overdue: overdue.sort(sorter),
      today: today.sort(sorter),
      upcoming: upcoming.sort(sorter),
      completed: completed.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) // Most recently completed first
    };
  };

  const groupedTasks = groupTasks();

  // Progress Calculation
  const getTodayProgress = () => {
    const now = new Date();
    const todayStr = now.toDateString();
    
    const todayTasks = tasks.filter(t => {
      const d = new Date(t.dueDate);
      return d.toDateString() === todayStr;
    });

    if (todayTasks.length === 0) return 0;
    const completedToday = todayTasks.filter(t => t.status === 'COMPLETED').length;
    return Math.round((completedToday / todayTasks.length) * 100);
  };
  const progress = getTodayProgress();

  const renderGroup = (title: string, groupTasks: Task[], icon: React.ReactNode, colorClass: string) => {
    if (groupTasks.length === 0) return null;
    return (
      <div className="mb-6">
        <h3 className={`text-sm font-bold uppercase tracking-wider mb-3 flex items-center gap-2 ${colorClass}`}>
          {icon}
          {title} 
          <span className="bg-onyx border border-garnet/40 text-silver px-2 py-0.5 rounded-full text-xs font-normal opacity-80">
            {groupTasks.length}
          </span>
        </h3>
        <div className="space-y-3">
          {groupTasks.map(task => (
            <TaskItem
              key={task.id}
              task={task}
              onUpdate={updateTask}
              onDelete={deleteTask}
              recipients={getActiveRecipients()}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-onyx text-smoke pb-20 font-sans">
      {showConfetti && <Confetti />}
      
      {/* Header */}
      <header className="bg-onyx/90 border-b border-garnet/30 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 pt-3 pb-0 flex flex-col gap-3">
          
          {/* Top Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Custom SVG Logo */}
              <svg width="42" height="42" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 drop-shadow-md">
                <path d="M20 8V16M35 8V16M50 8V16M65 8V16M80 8V16" stroke="#a4161a" strokeWidth="6" strokeLinecap="round"/>
                <path d="M20 84V92M35 84V92M50 84V92M65 84V92M80 84V92" stroke="#a4161a" strokeWidth="6" strokeLinecap="round"/>
                <path d="M8 20H16M8 35H16M8 50H16M8 65H16M8 80H16" stroke="#a4161a" strokeWidth="6" strokeLinecap="round"/>
                <path d="M84 20H92M84 35H92M84 50H92M84 65H92M84 80H92" stroke="#a4161a" strokeWidth="6" strokeLinecap="round"/>
                <rect x="16" y="16" width="68" height="68" rx="10" fill="#ba181b" />
                <rect x="24" y="24" width="52" height="52" rx="4" fill="#660708" />
                <rect x="26" y="26" width="48" height="48" rx="3" stroke="#e5383b" strokeWidth="2" />
                <text x="50" y="62" fontFamily="sans-serif" fontSize="30" fontWeight="bold" fill="white" textAnchor="middle">AI</text>
              </svg>

              <div className="flex flex-col">
                <h1 className="font-bold text-2xl tracking-tighter text-white leading-none">
                  TaskFlow
                </h1>
                <p className="text-xs text-silver/60 font-medium tracking-wide mt-0.5">
                  Welcome <span className="text-strawberry">Guest</span>
                  {!db.isRealMode && <span className="ml-2 text-[10px] bg-garnet/30 text-strawberry px-1.5 py-0.5 rounded border border-garnet/50">DEMO MODE</span>}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
               <button
                onClick={handleDailyBriefing}
                disabled={isBriefingLoading || emailContacts.filter(c => c.isActive).length === 0}
                className="hidden sm:flex items-center gap-2 bg-garnet/20 hover:bg-garnet/40 disabled:opacity-50 text-silver hover:text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border border-garnet/30"
                title="Generate a summary of all tasks and prepare an email"
               >
                 {isBriefingLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Sparkles className="w-4 h-4 text-strawberry"/>}
                 Briefing
               </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-6 mt-1">
            <button 
              onClick={() => setView('tasks')}
              className={`pb-3 text-sm font-medium transition-all relative ${
                view === 'tasks' ? 'text-strawberry' : 'text-silver hover:text-smoke'
              }`}
            >
              <div className="flex items-center gap-2">
                <ListTodo className="w-4 h-4" />
                My Tasks
              </div>
              {view === 'tasks' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-strawberry rounded-t-full" />}
            </button>
            
            <button 
              onClick={() => setView('planner')}
              className={`pb-3 text-sm font-medium transition-all relative ${
                view === 'planner' ? 'text-strawberry' : 'text-silver hover:text-smoke'
              }`}
            >
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4" />
                AI Planner
              </div>
              {view === 'planner' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-strawberry rounded-t-full" />}
            </button>
          </div>

        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        
        {view === 'tasks' ? (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            
            {/* Daily Progress Bar */}
            <div className="mb-6 bg-carbon/50 rounded-full h-1.5 w-full overflow-hidden border border-garnet/20 relative group" title="Today's Completion Progress">
               <div 
                 className="h-full bg-gradient-to-r from-mahogany to-strawberry transition-all duration-1000 ease-out"
                 style={{ width: `${progress}%` }}
               />
               {progress > 0 && <span className="absolute top-[-20px] right-0 text-[10px] text-strawberry font-bold">{progress}% Done</span>}
            </div>

            {/* Search Bar */}
            <div className="mb-6">
                <input 
                  type="text" 
                  placeholder="Search tasks..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-carbon border border-garnet/30 rounded-lg px-4 py-2.5 text-sm text-smoke focus:border-strawberry focus:ring-1 focus:ring-strawberry outline-none transition-all placeholder:text-silver/30"
                />
            </div>

            {/* Email & Info Section */}
            <div className="mb-8 bg-carbon border border-garnet/30 rounded-lg p-5 shadow-lg shadow-black/20">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-onyx rounded-lg border border-garnet/20">
                  <Info className="w-5 h-5 text-strawberry shrink-0" />
                </div>
                <div className="flex-1 w-full">
                  <h2 className="text-sm font-semibold text-smoke mb-1">Configuration Center</h2>
                  <p className="text-xs text-silver mb-4 leading-relaxed opacity-80 max-w-lg">
                    Connect your email addresses to receive daily briefings and task reminders. 
                  </p>
                  
                  <div className="space-y-3 bg-onyx/50 p-3 rounded-lg border border-garnet/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-3.5 h-3.5 text-strawberry"/>
                      <span className="text-xs font-medium text-silver uppercase tracking-wide">Email Recipients</span>
                    </div>
                    
                    {emailContacts.length > 0 ? (
                      <div className="space-y-2">
                        {emailContacts.map(contact => (
                          <div key={contact.id} className="flex items-center justify-between group p-1.5 hover:bg-carbon rounded transition-colors">
                            <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                contact.isActive ? 'bg-mahogany border-mahogany' : 'border-silver/40 bg-onyx'
                              }`}>
                                {contact.isActive && <Plus className="w-3 h-3 text-white rotate-45" />} 
                              </div>
                              <span className={`text-sm truncate ${contact.isActive ? 'text-smoke' : 'text-silver/50'}`}>
                                {contact.address}
                              </span>
                              <input 
                                type="checkbox" 
                                className="hidden" 
                                checked={contact.isActive} 
                                onChange={() => toggleEmailActive(contact.id)}
                              />
                            </label>
                            <button 
                              onClick={() => deleteEmail(contact.id)}
                              className="text-silver hover:text-strawberry p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Remove email"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-silver italic px-1">No email addresses saved.</p>
                    )}

                    <div className="flex gap-2 mt-3 pt-3 border-t border-garnet/30">
                      <input
                        type="email"
                        value={newEmailAddress}
                        onChange={(e) => setNewEmailAddress(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addEmail()}
                        placeholder="name@example.com"
                        className="flex-1 bg-onyx border border-garnet/30 rounded-md px-3 py-1.5 text-sm text-smoke placeholder:text-silver/40 focus:border-strawberry outline-none transition-colors"
                      />
                      <button 
                        onClick={addEmail}
                        disabled={!newEmailAddress.includes('@')}
                        className="bg-mahogany hover:bg-ruby disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1 shadow-md shadow-black/20"
                      >
                        <Plus className="w-4 h-4" />
                        Add
                      </button>
                    </div>
                  </div>
                  
                  {/* Mobile Briefing Button */}
                  <div className="mt-4 sm:hidden">
                    <button
                        onClick={handleDailyBriefing}
                        disabled={isBriefingLoading || emailContacts.filter(c => c.isActive).length === 0}
                        className="w-full flex items-center justify-center gap-2 bg-garnet/30 text-smoke px-3 py-2 rounded-lg text-xs border border-garnet/40"
                      >
                        {isBriefingLoading ? <Loader2 className="w-3 h-3 animate-spin"/> : <Mail className="w-3 h-3"/>}
                        Send Daily Briefing
                      </button>
                  </div>

                </div>
              </div>
            </div>

            {/* Input Area */}
            <TaskInput onTaskCreate={addTask} />

            {/* Task List */}
            {isDataLoading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 text-strawberry animate-spin" />
                </div>
            ) : (
                <div className="space-y-2">
                {tasks.length === 0 ? (
                    <div className="text-center py-20 bg-carbon rounded-xl border border-dashed border-garnet/30">
                    <CalendarIcon className="w-12 h-12 text-silver/20 mx-auto mb-3" />
                    <p className="text-silver/60">Your workspace is empty.</p>
                    <p className="text-sm text-strawberry/80 mt-1">Start by adding a task above.</p>
                    </div>
                ) : (
                    <>
                    {renderGroup("Overdue", groupedTasks.overdue, <span className="w-2 h-2 rounded-full bg-strawberry animate-pulse shadow-[0_0_8px_rgba(229,56,59,0.5)]"></span>, "text-strawberry")}
                    {renderGroup("Today", groupedTasks.today, <span className="w-2 h-2 rounded-full bg-smoke shadow-[0_0_8px_rgba(245,243,244,0.3)]"></span>, "text-smoke")}
                    {renderGroup("Upcoming", groupedTasks.upcoming, <span className="w-2 h-2 rounded-full bg-silver"></span>, "text-silver")}
                    
                    {groupedTasks.completed.length > 0 && (
                        <div className="mt-8 pt-8 border-t border-garnet/30">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-silver/40 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4" />
                                Completed Tasks
                            </h3>
                            <button 
                                onClick={clearCompletedTasks}
                                className="text-xs flex items-center gap-1 text-silver/40 hover:text-strawberry transition-colors"
                            >
                                <XCircle className="w-3 h-3" />
                                Clear All
                            </button>
                        </div>
                        <div className="space-y-3 opacity-50 hover:opacity-100 transition-opacity duration-300">
                            {groupedTasks.completed.map(task => (
                                <TaskItem
                                key={task.id}
                                task={task}
                                onUpdate={updateTask}
                                onDelete={deleteTask}
                                recipients={getActiveRecipients()}
                                />
                            ))}
                        </div>
                        </div>
                    )}
                    </>
                )}
                </div>
            )}
          </div>
        ) : (
          <PlannerView tasks={tasks} userId={GUEST_ID} />
        )}
      </main>
    </div>
  );
};

export default App;