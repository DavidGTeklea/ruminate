import { groq, CHAT_MODEL } from "@/lib/groq";
import { getSystemPrompt } from "@/lib/system-prompt";
import type Groq from "groq-sdk";

type ChatMessage = { role: "user" | "assistant"; content: string };

const calendarTool: Groq.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "create_calendar_event",
    description:
      "Creates a calendar reminder when the user wants to remember something at a specific time",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: 'Event title (e.g. "Standup meeting", "Doctor appointment")',
        },
        date: { type: "string", description: "Date in YYYY-MM-DD format" },
        time: { type: "string", description: "Time in HH:MM 24-hour format" },
        duration_minutes: {
          type: "number",
          description: "Duration in minutes (default 60)",
        },
      },
      required: ["title", "date", "time"],
    },
  },
};

function buildCalendarUrl(
  title: string,
  date: string,
  time: string,
  durationMinutes = 60
): string {
  const [year, month, day] = date.split("-");
  const [hour, minute] = time.split(":");
  const startStr = `${year}${month}${day}T${hour}${minute}00`;

  const endTotalMinutes =
    parseInt(hour) * 60 + parseInt(minute) + durationMinutes;
  const endHour = Math.floor(endTotalMinutes / 60) % 24;
  const endMin = endTotalMinutes % 60;
  const endStr = `${year}${month}${day}T${String(endHour).padStart(2, "0")}${String(endMin).padStart(2, "0")}00`;

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startStr}/${endStr}`;
}

export async function POST(request: Request) {
  const { messages }: { messages: ChatMessage[] } = await request.json();

  const systemMessage: Groq.Chat.Completions.ChatCompletionSystemMessageParam =
    { role: "system", content: getSystemPrompt() };

  // First call — may return tool use or a direct answer
  const first = await groq.chat.completions.create({
    model: CHAT_MODEL,
    messages: [systemMessage, ...messages],
    tools: [calendarTool],
    tool_choice: "auto",
    max_tokens: 400,
    temperature: 0.75,
  });

  const firstMessage = first.choices[0].message;
  const calendarEvents: object[] = [];

  if (
    firstMessage.tool_calls &&
    firstMessage.tool_calls.length > 0 &&
    first.choices[0].finish_reason === "tool_calls"
  ) {
    const toolResults: Groq.Chat.Completions.ChatCompletionToolMessageParam[] =
      [];

    for (const tc of firstMessage.tool_calls) {
      if (tc.function.name === "create_calendar_event") {
        const args = JSON.parse(tc.function.arguments) as {
          title: string;
          date: string;
          time: string;
          duration_minutes?: number;
        };
        const url = buildCalendarUrl(
          args.title,
          args.date,
          args.time,
          args.duration_minutes
        );
        calendarEvents.push({ ...args, url });
        toolResults.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify({ success: true, calendarUrl: url }),
        });
      }
    }

    // Second call with tool results to get the final text response
    const second = await groq.chat.completions.create({
      model: CHAT_MODEL,
      messages: [systemMessage, ...messages, firstMessage, ...toolResults],
      max_tokens: 300,
      temperature: 0.75,
    });

    return Response.json({
      content: second.choices[0].message.content,
      calendarEvents,
    });
  }

  return Response.json({ content: firstMessage.content, calendarEvents });
}
