import { GoogleGenAI, Type } from "@google/genai";
import { ParsedTaskResponse, Priority, AIGeneratedEmail, Task, ScheduleItem, BrainstormResponse, Mood, AIPersona } from "../types";

// Initialize the Gemini Client
// IMPORTANT: The API key is injected via process.env.API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const modelId = "gemini-2.5-flash";

// Helper to clean potential markdown formatting from JSON responses
const cleanJSON = (text: string) => {
  if (!text) return "";
  
  // Remove markdown code blocks first
  let cleaned = text.replace(/```(?:json)?\n?/g, "").replace(/```/g, "").trim();

  // Robustly extract the JSON object/array
  const firstOpenBrace = cleaned.indexOf('{');
  const lastCloseBrace = cleaned.lastIndexOf('}');
  const firstOpenBracket = cleaned.indexOf('[');
  const lastCloseBracket = cleaned.lastIndexOf(']');

  // Determine if it looks like an object or array and slice accordingly
  if (firstOpenBrace !== -1 && lastCloseBrace !== -1 && lastCloseBrace > firstOpenBrace) {
      // Check if bracket is outer (array of objects)
      if (firstOpenBracket !== -1 && firstOpenBracket < firstOpenBrace && lastCloseBracket > lastCloseBrace) {
          return cleaned.substring(firstOpenBracket, lastCloseBracket + 1);
      }
      return cleaned.substring(firstOpenBrace, lastCloseBrace + 1);
  }
  
  if (firstOpenBracket !== -1 && lastCloseBracket !== -1 && lastCloseBracket > firstOpenBracket) {
      return cleaned.substring(firstOpenBracket, lastCloseBracket + 1);
  }

  return cleaned;
};

/**
 * Parses natural language input into a structured task object.
 */
export const parseTaskFromInput = async (input: string, mood: Mood = 'neutral'): Promise<ParsedTaskResponse> => {
  const currentDate = new Date().toISOString();
  
  const prompt = `
    Current Date/Time: ${currentDate}
    User Input: "${input}"
    User Mood: ${mood}
    
    Extract the task details.
    1. STRICTLY use ISO 8601 format (YYYY-MM-DDTHH:mm:ss) for dueDate.
    2. Auto-tag the task based on context.
    3. Return valid JSON only.
  `;

  const response = await ai.models.generateContent({
    model: modelId,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "A concise title" },
          description: { type: Type.STRING, description: "A helpful description" },
          dueDate: { type: Type.STRING, description: "ISO 8601 Date string" },
          priority: { 
            type: Type.STRING, 
            enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] 
          },
          tags: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["title", "description", "dueDate", "priority"]
      }
    }
  });

  if (!response.text) {
    throw new Error("Failed to generate task details");
  }

  try {
    return JSON.parse(cleanJSON(response.text)) as ParsedTaskResponse;
  } catch (e) {
    console.error("JSON Parse Error:", response.text);
    throw new Error("Failed to parse AI response");
  }
};

/**
 * Brainstorms a goal into actionable tasks
 */
export const brainstormGoal = async (goal: string, mood: Mood): Promise<ParsedTaskResponse[]> => {
  const currentDate = new Date().toISOString();
  
  const prompt = `
    Goal: "${goal}"
    Current Date: ${currentDate}
    User Mood: ${mood}
    
    Break this goal down into 3-5 actionable, concrete tasks.
    IMPORTANT: Return due dates in strict ISO 8601 format (YYYY-MM-DDTHH:mm:ss).
    Do not use natural language for dates (e.g. "Tomorrow" is invalid).
  `;

  const response = await ai.models.generateContent({
    model: modelId,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          tasks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
               properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                dueDate: { type: Type.STRING, description: "ISO 8601 Date String" },
                priority: { 
                  type: Type.STRING, 
                  enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] 
                },
                tags: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
            }
          }
        },
        required: ["tasks"]
      }
    }
  });

  if (!response.text) return [];
  try {
    const data = JSON.parse(cleanJSON(response.text));
    return data.tasks || [];
  } catch (e) {
    console.error("Brainstorm Parse Error", e);
    return [];
  }
};

/**
 * Generates a motivational or urgent email draft.
 */
export const generateReminderEmail = async (taskTitle: string, dueDate: string, priority: Priority, mood: Mood, persona: AIPersona): Promise<AIGeneratedEmail> => {
  const prompt = `
    Write a short email reminder.
    Task: "${taskTitle}"
    Due: ${dueDate}
    Priority: ${priority}
    AI Persona: ${persona}
    User Mood: ${mood}
    
    Keep the body under 200 words.
  `;

  const response = await ai.models.generateContent({
    model: modelId,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          subject: { type: Type.STRING },
          body: { type: Type.STRING },
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
    Task: "${taskTitle}"
    Context: "${taskDescription}"
    
    Break this into 3-5 small, actionable sub-steps.
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
export const generateDailyBriefing = async (tasks: Task[], mood: Mood, persona: AIPersona): Promise<AIGeneratedEmail> => {
  const activeTasks = tasks.filter(t => t.status !== 'COMPLETED').slice(0, 15); // Limit to 15 to avoid token limits
  
  const tasksList = activeTasks.map(t => 
    `- [${t.priority}] ${t.title} (Due: ${t.dueDate})`
  ).join('\n');

  const prompt = `
    Current Date: ${new Date().toLocaleDateString()}
    User Mood: ${mood}
    AI Persona: ${persona}
    
    Task List:
    ${tasksList}
    
    Write a concise daily briefing.
  `;

  const response = await ai.models.generateContent({
    model: modelId,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          subject: { type: Type.STRING },
          body: { type: Type.STRING }
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
 * Generates a daily schedule based on tasks.
 */
export const generateDailyPlan = async (tasks: Task[], notes: string, targetDate: string, mood: Mood): Promise<ScheduleItem[]> => {
  const activeTasks = tasks.filter(t => t.status !== 'COMPLETED').slice(0, 20).map(t => 
    `- ${t.title} (Priority: ${t.priority})`
  ).join('\n');

  const target = new Date(targetDate);
  const today = new Date();
  const isToday = target.toDateString() === today.toDateString();
  
  const startTimeContext = isToday 
    ? `Current time is ${today.toLocaleTimeString()}.` 
    : `Start day at 09:00 AM.`;

  const prompt = `
    Create a schedule for ${targetDate}.
    ${startTimeContext}
    User Mood: ${mood}.
    Notes: "${notes}"
    
    Tasks to fit in:
    ${activeTasks}
    
    CRITICAL: The 'time' field MUST be in the format "HH:MM - HH:MM" (e.g. "09:00 - 10:00").
    Do not use "9am" or other formats.
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
                time: { type: Type.STRING, description: "Format: HH:MM - HH:MM" },
                activity: { type: Type.STRING },
                type: { type: Type.STRING, enum: ['task', 'break', 'focus'] },
                notes: { type: Type.STRING }
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

  try {
    return JSON.parse(cleanJSON(response.text)).schedule;
  } catch (e) {
    console.error("Schedule Parse Error", e);
    throw new Error("AI returned invalid schedule format");
  }
};