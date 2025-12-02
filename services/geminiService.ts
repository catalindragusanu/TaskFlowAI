import { GoogleGenAI, Type } from "@google/genai";
import { ParsedTaskResponse, Priority, AIGeneratedEmail, Task, ScheduleItem } from "../types";

// Initialize the Gemini Client
// IMPORTANT: The API key is injected via process.env.API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const modelId = "gemini-2.5-flash";

// Helper to clean potential markdown formatting from JSON responses
const cleanJSON = (text: string) => {
  if (!text) return "";
  
  // Try to find JSON object or array
  const match = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (match) {
      return match[0];
  }
  
  // Remove markdown code blocks like ```json ... ``` or ``` ... ```
  return text.replace(/```(?:json)?\n?/g, "").replace(/```/g, "").trim();
};

/**
 * Parses natural language input into a structured task object.
 */
export const parseTaskFromInput = async (input: string): Promise<ParsedTaskResponse> => {
  const currentDate = new Date().toISOString();
  
  const prompt = `
    Current Date/Time: ${currentDate}
    
    User Input: "${input}"
    
    Extract the task details from the user input. 
    If no date is specified, assume it is due tomorrow at 9 AM.
    Infer the priority based on words like "urgent", "important", "asap". Default to MEDIUM.
    Create a short description if one isn't explicitly provided, summarizing the intent.
  `;

  const response = await ai.models.generateContent({
    model: modelId,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "A concise title for the task" },
          description: { type: Type.STRING, description: "A helpful description of what needs to be done" },
          dueDate: { type: Type.STRING, description: "ISO 8601 Date string for when the task is due" },
          priority: { 
            type: Type.STRING, 
            enum: [Priority.LOW, Priority.MEDIUM, Priority.HIGH, Priority.URGENT] 
          }
        },
        required: ["title", "description", "dueDate", "priority"]
      }
    }
  });

  if (!response.text) {
    throw new Error("Failed to generate task details");
  }

  return JSON.parse(cleanJSON(response.text)) as ParsedTaskResponse;
};

/**
 * Generates a motivational or urgent email draft for the user to send to themselves.
 */
export const generateReminderEmail = async (taskTitle: string, dueDate: string, priority: Priority): Promise<AIGeneratedEmail> => {
  const prompt = `
    Write a short, effective email reminder for a task.
    Task: "${taskTitle}"
    Due Date: ${dueDate}
    Priority: ${priority}
    
    The email is for the user to send to themselves.
    If priority is HIGH or URGENT, make the tone urgent and direct.
    If priority is LOW or MEDIUM, make the tone encouraging and helpful.
    Keep it brief.
  `;

  const response = await ai.models.generateContent({
    model: modelId,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          subject: { type: Type.STRING, description: "Email subject line" },
          body: { type: Type.STRING, description: "Email body text" },
        },
        required: ["subject", "body"]
      }
    }
  });

  if (!response.text) {
    throw new Error("Failed to generate email draft");
  }

  return JSON.parse(cleanJSON(response.text)) as AIGeneratedEmail;
};

/**
 * Breaks down a complex task into smaller subtasks using AI.
 */
export const breakDownTask = async (taskTitle: string, taskDescription: string): Promise<string[]> => {
  const prompt = `
    The user has a task: "${taskTitle}"
    Description: "${taskDescription}"
    
    Break this task down into 3 to 5 actionable, small sub-steps.
    Keep them concise (under 10 words each).
    Return a JSON object containing a list of steps.
  `;

  const response = await ai.models.generateContent({
    model: modelId,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          steps: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["steps"]
      }
    }
  });

  if (!response.text) {
    throw new Error("Failed to generate subtasks");
  }

  return JSON.parse(cleanJSON(response.text)).steps;
};

/**
 * Generates a daily briefing email summary of all tasks.
 */
export const generateDailyBriefing = async (tasks: Task[]): Promise<AIGeneratedEmail> => {
  // Filter for incomplete tasks only
  const activeTasks = tasks.filter(t => t.status !== 'COMPLETED');
  
  if (activeTasks.length === 0) {
    return {
      subject: "Daily Briefing: All Caught Up!",
      body: "You have no pending tasks. Great job! Enjoy your day."
    };
  }

  const tasksList = activeTasks.map(t => 
    `- [${t.priority}] ${t.title} (Due: ${t.dueDate})`
  ).join('\n');

  const prompt = `
    Current Date: ${new Date().toLocaleDateString()}
    
    Here is the user's task list:
    ${tasksList}
    
    Write a daily briefing email for the user to send to themselves.
    1. Summarize the most urgent items first.
    2. Provide a short motivational quote or encouragement at the end.
    3. Format the body as plain text suitable for a mailto link (no HTML tags, just line breaks).
  `;

  const response = await ai.models.generateContent({
    model: modelId,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          subject: { type: Type.STRING, description: "Engaging subject line for daily briefing" },
          body: { type: Type.STRING, description: "The email body text" }
        },
        required: ["subject", "body"]
      }
    }
  });

  if (!response.text) {
    throw new Error("Failed to generate briefing");
  }

  return JSON.parse(cleanJSON(response.text)) as AIGeneratedEmail;
};

/**
 * Generates a daily schedule based on tasks, user intent, and a specific date.
 */
export const generateDailyPlan = async (tasks: Task[], notes: string, targetDate: string): Promise<ScheduleItem[]> => {
  const activeTasks = tasks.filter(t => t.status !== 'COMPLETED').map(t => 
    `- ${t.title} (Priority: ${t.priority}, Due: ${t.dueDate})`
  ).join('\n');

  // Determine if we are planning for today or a future date to set start time context
  const target = new Date(targetDate);
  const today = new Date();
  const isToday = target.toDateString() === today.toDateString();
  
  const startTimeContext = isToday 
    ? `The current time is ${today.toLocaleTimeString()}. Start the schedule from now.` 
    : `This plan is for a future date (${targetDate}). Start the schedule at 09:00 AM.`;

  const prompt = `
    I need a daily schedule plan for ${targetDate}.
    ${startTimeContext}
    
    My Tasks Available:
    ${activeTasks}
    
    My Notes/Configuration for this day:
    "${notes}"
    
    Create a realistic hourly schedule.
    - End around 6 PM or later if needed.
    - Prioritize High/Urgent tasks that are due soon.
    - Include short breaks.
    - Group similar tasks if possible.
    
    Return a JSON object with a 'schedule' property containing the array of schedule items.
  `;

  const response = await ai.models.generateContent({
    model: modelId,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          schedule: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                time: { type: Type.STRING, description: "Time range (e.g. '09:00 - 10:00')" },
                activity: { type: Type.STRING, description: "What to do" },
                type: { type: Type.STRING, enum: ['task', 'break', 'focus'] },
                notes: { type: Type.STRING, description: "Short tip or detail" }
              },
              required: ["time", "activity", "type"]
            }
          }
        },
        required: ["schedule"]
      }
    }
  });

  if (!response.text) {
    throw new Error("Failed to generate schedule");
  }

  return JSON.parse(cleanJSON(response.text)).schedule;
};