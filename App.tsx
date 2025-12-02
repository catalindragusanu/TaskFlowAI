import React, { useState, useEffect } from 'react';
import { TaskInput } from './components/TaskInput';
import { TaskItem } from './components/TaskItem';
import { PlannerView } from './components/PlannerView';
import { AnalyticsView } from './components/AnalyticsView';
import { Task, EmailContact, UserProfile, Mood, AIPersona } from './types';
import { Calendar as CalendarIcon, Info, Sparkles, Loader2, Mail, CheckCircle2, Plus, Trash2, Users, ListTodo, CalendarClock, XCircle, BarChart3, Zap, Brain, Slack, Trello, Smile, Timer, User as UserIcon, X, Save, LogOut, LogIn, Check } from 'lucide-react';
import { generateDailyBriefing } from './services/geminiService';
import { getMailtoLink } from './utils/dateUtils';
import { v4 as uuidv4 } from 'uuid';
import { db } from './services/databaseService';
import { useToast } from './components/Toast';
import { Confetti } from './components/Confetti';
import { LoginPage } from './components/LoginPage';
import { SignupPage } from './components/SignupPage';

type ViewMode = 'tasks' | 'planner' | 'analytics';
type AuthMode = 'app' | 'login' | 'signup';

const App: React.FC = () => {
  // User Profile State - Persisted locally
  // db.getCurrentUser() guarantees a return value (Guest or stored)
  const [user, setUser] = useState<UserProfile>(() => db.getCurrentUser());
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [tempName, setTempName] = useState('');
  const [authMode, setAuthMode] = useState<AuthMode>('app');

  const [view, setView] = useState<ViewMode>('tasks');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [emailContacts, setEmailContacts] = useState<EmailContact[]>([]);
  const [newEmailAddress, setNewEmailAddress] = useState('');
  const [isBriefingLoading, setIsBriefingLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false);
  
  // Mood & Persona
  const [mood, setMood] = useState<Mood>('neutral');
  const [persona, setPersona] = useState<AIPersona>('motivator');
  
  // Pomodoro
  const [pomodoroTime, setPomodoroTime] = useState(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Search, Progress, and Rewards
  const [searchQuery, setSearchQuery] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);
  const { addToast } = useToast();

  // Integrations State (Visual Mock)
  const [activeIntegrations, setActiveIntegrations] = useState<string[]>([]);

  // Load Data
  useEffect(() => {
    if (user) {
      loadUserData(user.id);
    }
  }, [user.id]); // Reload if user ID changes

  // Pomodoro Timer Logic
  useEffect(() => {
    let interval: any;
    if (isTimerRunning && pomodoroTime > 0) {
        interval = setInterval(() => setPomodoroTime(t => t - 1), 1000);
    } else if (pomodoroTime === 0) {
        setIsTimerRunning(false);
        addToast("Focus session complete!", "success");
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, pomodoroTime]);

  const toggleTimer = () => setIsTimerRunning(!isTimerRunning);
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const loadUserData = async (userId: string) => {
    setIsDataLoading(true);
    try {
      const [fetchedTasks, fetchedContacts] = await Promise.all([
        db.getTasks(userId),
        db.getContacts(userId)
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

  const handleUpdateProfile = async () => {
      if (!tempName.trim()) return;
      const updatedUser = { ...user, name: tempName };
      await db.updateUserProfile(updatedUser);
      setUser(updatedUser); // Update local state immediately
      setIsEditingProfile(false);
      addToast("Profile updated", "success");
  };

  const openProfileEdit = () => {
      setTempName(user.name);
      setIsEditingProfile(true);
  };

  const handleLoginSuccess = (loggedInUser: UserProfile) => {
      setUser(loggedInUser);
      setAuthMode('app');
      addToast(`Welcome back, ${loggedInUser.name}!`, 'success');
  };

  const handleLogout = async () => {
      await db.logout();
      // Reset to guest
      const guest = db.getCurrentUser();
      setUser(guest);
      setAuthMode('app'); // Stay in app as guest
      addToast("Logged out successfully", "info");
  };

  const addTask = async (taskData: any) => {
    if (!user) return;
    const newTask: Task = { ...taskData, userId: user.id };
    
    // Optimistic update
    setTasks(prev => [newTask, ...prev]);
    
    try {
      await db.addTask(newTask);
    } catch (e) {
      console.error(e);
      addToast('Failed to save task', 'error');
      loadUserData(user.id);
    }
  };

  const deleteTask = async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id)); // Optimistic
    try {
      await db.deleteTask(id);
      addToast('Task deleted', 'success');
    } catch (e) {
       if (user) loadUserData(user.id);
    }
  };

  const clearCompletedTasks = async (e?: React.MouseEvent) => {
    if (!user) return;
    e?.stopPropagation();
    if (window.confirm("Are you sure you want to remove all completed tasks?")) {
        try {
          await db.clearCompletedTasks(user.id);
          const freshTasks = await db.getTasks(user.id);
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
      if (user) loadUserData(user.id);
    }
  };

  // Email Management Logic
  const addEmail = async () => {
    if (!user || !newEmailAddress || !newEmailAddress.includes('@')) return;
    
    const newContact: EmailContact = { 
        id: uuidv4(), 
        userId: user.id,
        address: newEmailAddress.trim(), 
        isActive: true 
    };
    
    try {
      await db.addContact(newContact);
      const freshContacts = await db.getContacts(user.id);
      setEmailContacts(freshContacts);
      setNewEmailAddress('');
      addToast('Email contact added', 'success');
    } catch (e) {
      addToast('Failed to add email', 'error');
    }
  };

  const deleteEmail = async (id: string) => {
    if (!user) return;
    try {
      await db.deleteContact(id);
      const freshContacts = await db.getContacts(user.id);
      setEmailContacts(freshContacts);
      addToast('Email contact removed', 'success');
    } catch (e) {
       addToast('Failed to remove email', 'error');
    }
  };

  const toggleEmailActive = async (id: string) => {
    if (!user) return;
    const contact = emailContacts.find(c => c.id === id);
    if (contact) {
        const updated = { ...contact, isActive: !contact.isActive };
        try {
          await db.updateContact(updated);
          const freshContacts = await db.getContacts(user.id);
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
      const emailContent = await generateDailyBriefing(tasks, mood, persona);
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

  // Mock integration click with toggle state
  const handleIntegrationClick = (name: string) => {
      if (activeIntegrations.includes(name)) {
          setActiveIntegrations(prev => prev.filter(i => i !== name));
          addToast(`${name} disconnected.`, "info");
      } else {
          setActiveIntegrations(prev => [...prev, name]);
          addToast(`${name} connected successfully!`, "success");
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

    const sorter = (a: Task, b: Task) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    
    return {
      overdue: overdue.sort(sorter),
      today: today.sort(sorter),
      upcoming: upcoming.sort(sorter),
      completed: completed.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    };
  };

  const groupedTasks = groupTasks();

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
      <div className="mb-6 animate-in slide-in-from-bottom-2 duration-500">
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
              userMood={mood}
              persona={persona}
            />
          ))}
        </div>
      </div>
    );
  };

  if (authMode === 'login') {
    return <LoginPage onLogin={handleLoginSuccess} onGotoSignup={() => setAuthMode('signup')} />;
  }

  if (authMode === 'signup') {
    return <SignupPage onLogin={handleLoginSuccess} onBack={() => setAuthMode('login')} />;
  }

  return (
    <div className="min-h-screen bg-onyx text-smoke pb-20 font-sans">
      {showConfetti && <Confetti />}
      
      {/* Header */}
      <header className="bg-onyx/90 border-b border-garnet/30 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 pt-3 pb-0 flex flex-col gap-3">
          
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
                <div className="flex items-center gap-2">
                    <p className="text-xs text-silver/60 font-medium tracking-wide mt-0.5 hidden sm:block">
                    Welcome <span className="text-strawberry">{user.name}</span>
                    </p>
                    <button onClick={openProfileEdit} className="text-[10px] text-silver/40 hover:text-silver border border-garnet/20 px-1.5 rounded hover:bg-carbon transition-colors">
                        Edit
                    </button>
                    <div className="h-3 w-px bg-garnet/30 mx-1"></div>
                    {user.id === 'guest-user' ? (
                        <button onClick={() => setAuthMode('login')} className="text-[10px] text-strawberry hover:text-white flex items-center gap-1 transition-colors">
                            <LogIn className="w-3 h-3"/> Login
                        </button>
                    ) : (
                        <button onClick={handleLogout} className="text-[10px] text-silver/40 hover:text-white flex items-center gap-1 transition-colors">
                            <LogOut className="w-3 h-3"/> Logout
                        </button>
                    )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
               
               {/* Mood Selector */}
               <div className="hidden md:flex items-center bg-carbon border border-garnet/30 rounded-lg p-0.5">
                  {(['focused', 'creative', 'stress', 'neutral'] as const).map((m) => (
                    <button
                        key={m}
                        onClick={() => setMood(m === 'stress' ? 'stressed' : m)}
                        className={`p-1.5 rounded transition-all ${
                            (mood === m || (m === 'stress' && mood === 'stressed')) ? 'bg-garnet text-white' : 'text-silver hover:text-smoke'
                        }`}
                        title={`Set mood: ${m}`}
                    >
                        {m === 'focused' && <Zap className="w-4 h-4"/>}
                        {m === 'creative' && <Brain className="w-4 h-4"/>}
                        {m === 'stress' && <Smile className="w-4 h-4 rotate-180"/>}
                        {m === 'neutral' && <Smile className="w-4 h-4"/>}
                    </button>
                  ))}
               </div>

               {/* Pomodoro Timer Mini */}
               <button 
                onClick={toggleTimer}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                    isTimerRunning ? 'bg-strawberry text-white border-strawberry' : 'bg-carbon border-garnet/30 text-silver hover:text-white'
                }`}
               >
                   <Timer className={`w-4 h-4 ${isTimerRunning ? 'animate-pulse' : ''}`}/>
                   <span className="font-mono">{formatTime(pomodoroTime)}</span>
               </button>

               <button
                type="button"
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
          <div className="flex items-center gap-6 mt-1 overflow-x-auto no-scrollbar">
            <button 
              type="button"
              onClick={() => setView('tasks')}
              className={`pb-3 text-sm font-medium transition-all relative shrink-0 ${
                view === 'tasks' ? 'text-strawberry' : 'text-silver hover:text-smoke'
              }`}
            >
              <div className="flex items-center gap-2">
                <ListTodo className="w-4 h-4" />
                Tasks
              </div>
              {view === 'tasks' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-strawberry rounded-t-full" />}
            </button>
            
            <button 
              type="button"
              onClick={() => setView('planner')}
              className={`pb-3 text-sm font-medium transition-all relative shrink-0 ${
                view === 'planner' ? 'text-strawberry' : 'text-silver hover:text-smoke'
              }`}
            >
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4" />
                AI Planner
              </div>
              {view === 'planner' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-strawberry rounded-t-full" />}
            </button>

            <button 
              type="button"
              onClick={() => setView('analytics')}
              className={`pb-3 text-sm font-medium transition-all relative shrink-0 ${
                view === 'analytics' ? 'text-strawberry' : 'text-silver hover:text-smoke'
              }`}
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Analytics
              </div>
              {view === 'analytics' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-strawberry rounded-t-full" />}
            </button>
          </div>

        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        
        {view === 'tasks' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            
            {/* Daily Progress Bar */}
            <div className="mb-6 bg-carbon/50 rounded-full h-1.5 w-full overflow-hidden border border-garnet/20 relative group" title="Today's Completion Progress">
               <div 
                 className="h-full bg-gradient-to-r from-mahogany to-strawberry transition-all duration-1000 ease-out"
                 style={{ width: `${progress}%` }}
               />
               {progress > 0 && <span className="absolute top-[-20px] right-0 text-[10px] text-strawberry font-bold">{progress}% Done</span>}
            </div>

            {/* Input Area */}
            <TaskInput onTaskCreate={addTask} userMood={mood} />

            {/* Integrations Bar (Mock) */}
            <div className="flex items-center gap-4 mb-6 overflow-x-auto no-scrollbar pb-2">
                <div className="text-xs font-semibold text-silver/40 uppercase tracking-wider shrink-0">Integrations:</div>
                <button 
                    onClick={() => handleIntegrationClick('Slack')} 
                    className={`flex items-center gap-1 border px-2 py-1 rounded text-xs transition-colors ${
                        activeIntegrations.includes('Slack') 
                        ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' 
                        : 'bg-carbon border-garnet/20 text-silver hover:text-white hover:border-garnet/50'
                    }`}
                >
                    <Slack className="w-3 h-3" /> Slack
                    {activeIntegrations.includes('Slack') && <Check className="w-3 h-3 ml-1" />}
                </button>
                <button 
                    onClick={() => handleIntegrationClick('Trello')} 
                    className={`flex items-center gap-1 border px-2 py-1 rounded text-xs transition-colors ${
                        activeIntegrations.includes('Trello') 
                        ? 'bg-blue-600/10 border-blue-600/50 text-blue-500' 
                        : 'bg-carbon border-garnet/20 text-silver hover:text-white hover:border-garnet/50'
                    }`}
                >
                    <Trello className="w-3 h-3" /> Trello
                    {activeIntegrations.includes('Trello') && <Check className="w-3 h-3 ml-1" />}
                </button>
                <button 
                    onClick={() => handleIntegrationClick('Notion')} 
                    className={`flex items-center gap-1 border px-2 py-1 rounded text-xs transition-colors ${
                        activeIntegrations.includes('Notion') 
                        ? 'bg-white/10 border-white/50 text-white' 
                        : 'bg-carbon border-garnet/20 text-silver hover:text-white hover:border-garnet/50'
                    }`}
                >
                    <div className="w-3 h-3 bg-current flex items-center justify-center font-bold text-[8px] rounded-sm text-carbon">N</div> Notion
                    {activeIntegrations.includes('Notion') && <Check className="w-3 h-3 ml-1" />}
                </button>
                <button onClick={() => addToast("Connect more integrations in settings", "info")} className="flex items-center gap-1 bg-carbon border border-garnet/20 px-2 py-1 rounded text-xs text-silver hover:text-white hover:border-garnet/50 transition-colors ml-auto">
                    <Plus className="w-3 h-3" /> Connect
                </button>
            </div>

            {/* Task List */}
            {isDataLoading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 text-strawberry animate-spin" />
                </div>
            ) : (
                <div className="space-y-2">
                {tasks.length === 0 ? (
                    // 1.1 Workspace Clarity: Empty State
                    <div className="text-center py-16 bg-carbon/30 rounded-xl border border-dashed border-garnet/30 flex flex-col items-center">
                        <div className="w-16 h-16 bg-onyx rounded-full flex items-center justify-center mb-4 border border-garnet/20">
                            <Sparkles className="w-8 h-8 text-strawberry/50" />
                        </div>
                        <h3 className="text-lg font-semibold text-smoke mb-2">Ready to get things done?</h3>
                        <p className="text-silver/60 max-w-sm mb-6">
                            Start by adding your first task above, or try <span className="text-strawberry">Brainstorm Mode</span> to break down a big goal.
                        </p>
                        
                        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md opacity-50 pointer-events-none select-none">
                            <div className="bg-carbon p-3 rounded-lg border border-garnet/20 w-full">
                                <div className="h-4 w-3/4 bg-onyx rounded mb-2"></div>
                                <div className="h-3 w-1/2 bg-onyx rounded"></div>
                            </div>
                             <div className="bg-carbon p-3 rounded-lg border border-garnet/20 w-full hidden sm:block">
                                <div className="h-4 w-2/3 bg-onyx rounded mb-2"></div>
                                <div className="h-3 w-1/2 bg-onyx rounded"></div>
                            </div>
                        </div>
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
                                type="button"
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
                                userMood={mood}
                                persona={persona}
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
        )}

        {view === 'planner' && (
             <PlannerView tasks={tasks} userId={user.id} />
        )}

        {view === 'analytics' && (
            <AnalyticsView tasks={tasks} />
        )}

        {/* Configuration Section (Moved to bottom or separate tab in future, currently kept for email management) */}
        {view === 'tasks' && (
            <div className="mt-12 pt-8 border-t border-garnet/20">
                <details className="group">
                    <summary className="list-none flex items-center gap-2 text-xs font-semibold text-silver/50 uppercase tracking-wider cursor-pointer hover:text-strawberry transition-colors">
                        <Info className="w-4 h-4" />
                        Settings & Email Config
                    </summary>
                    <div className="mt-4 bg-carbon border border-garnet/30 rounded-lg p-5 shadow-lg shadow-black/20 animate-in fade-in slide-in-from-top-2">
                         <div className="flex items-start gap-4">
                            <div className="flex-1 w-full">
                                <h2 className="text-sm font-semibold text-smoke mb-1">Email Notifications</h2>
                                <p className="text-xs text-silver mb-4 leading-relaxed opacity-80 max-w-lg">
                                    Manage who receives the AI briefings and reminders.
                                </p>
                                
                                <div className="space-y-3 bg-onyx/50 p-3 rounded-lg border border-garnet/30">
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
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                deleteEmail(contact.id);
                                            }}
                                            className="text-silver hover:text-strawberry p-2 rounded hover:bg-onyx transition-colors ml-2"
                                            title="Remove email"
                                            >
                                            <Trash2 className="w-4 h-4" />
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
                                        type="button"
                                        onClick={addEmail}
                                        disabled={!newEmailAddress.includes('@')}
                                        className="bg-mahogany hover:bg-ruby disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1 shadow-md shadow-black/20"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Add
                                    </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </details>
            </div>
        )}
      </main>

      {/* Edit Profile Modal */}
      {isEditingProfile && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-carbon border border-garnet/30 rounded-xl shadow-2xl w-full max-w-sm p-6 relative">
                <button onClick={() => setIsEditingProfile(false)} className="absolute top-4 right-4 text-silver hover:text-white"><X className="w-5 h-5"/></button>
                <h3 className="text-lg font-bold text-smoke mb-4 flex items-center gap-2"><UserIcon className="w-5 h-5 text-strawberry"/> Edit Profile</h3>
                
                <div className="space-y-3">
                    <div>
                        <label className="text-xs font-medium text-silver block mb-1.5">Display Name</label>
                        <input 
                            type="text" 
                            value={tempName}
                            onChange={(e) => setTempName(e.target.value)}
                            className="w-full bg-onyx text-smoke rounded-lg px-3 py-2 border border-garnet/40 focus:border-strawberry outline-none"
                            placeholder="Your Name"
                            autoFocus
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                     <button onClick={() => setIsEditingProfile(false)} className="px-3 py-2 text-sm text-silver hover:text-white">Cancel</button>
                     <button onClick={handleUpdateProfile} className="bg-mahogany hover:bg-ruby text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"><Save className="w-4 h-4"/> Save</button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default App;