export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED'
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  password?: string;
  joinedAt: string;
}

export interface Subtask {
  id: string;
  title: string;
  isCompleted: boolean;
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  description: string;
  dueDate: string; // ISO String
  priority: Priority;
  status: TaskStatus;
  createdAt: string;
  calendarEventUrl?: string;
  subtasks?: Subtask[];
}

export interface ParsedTaskResponse {
  title: string;
  description: string;
  dueDate: string;
  priority: Priority;
}

export interface AIGeneratedEmail {
  subject: string;
  body: string;
}

export interface EmailContact {
  id: string;
  userId: string;
  address: string;
  isActive: boolean;
}

export interface ScheduleItem {
  time: string;
  activity: string;
  type: 'task' | 'break' | 'focus';
  notes?: string;
}

export type IconKey = 'brain' | 'clock' | 'briefcase' | 'sun' | 'coffee' | 'zap' | 'list';

export interface PlanTemplate {
  id: string;
  userId?: string; // Optional for default templates
  label: string;
  iconKey: IconKey;
  prompt: string;
  isCustom?: boolean;
}

export interface DailyPlan {
  date: string; // YYYY-MM-DD
  userId: string;
  schedule: ScheduleItem[];
  notes: string;
}