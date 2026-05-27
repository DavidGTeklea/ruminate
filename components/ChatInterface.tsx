"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Moon, Mic, MicOff, Send, Calendar, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";

type TextMessage = {
  id: string;
  type: "text";
  role: "user" | "assistant";
  content: string;
};

type CalendarItem = {
  id: string;
  type: "calendar";
  title: string;
  date: string;
  time: string;
  duration_minutes?: number;
  url: string;
};

type ChatItem = TextMessage | CalendarItem;

export default function ChatInterface() {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [items, isLoading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  function speak(text: string) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.88;
    utterance.pitch = 0.95;
    utterance.volume = 0.9;

    const trySetVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(
        (v) =>
          v.name.includes("Samantha") ||
          v.name.includes("Karen") ||
          v.name.includes("Moira") ||
          (v.lang.startsWith("en") && v.localService)
      );
      if (preferred) utterance.voice = preferred;
    };

    if (window.speechSynthesis.getVoices().length > 0) {
      trySetVoice();
    } else {
      window.speechSynthesis.onvoiceschanged = trySetVoice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      const userItem: TextMessage = {
        id: crypto.randomUUID(),
        type: "text",
        role: "user",
        content: content.trim(),
      };

      setItems((prev) => [...prev, userItem]);
      setInput("");
      setIsLoading(true);
      stopSpeaking();

      const history = [...items, userItem]
        .filter((i): i is TextMessage => i.type === "text")
        .map(({ role, content }) => ({ role, content }));

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history }),
        });

        const data: {
          content: string;
          calendarEvents: Array<{
            title: string;
            date: string;
            time: string;
            duration_minutes?: number;
            url: string;
          }>;
        } = await res.json();

        if (data.content) {
          const assistantItem: TextMessage = {
            id: crypto.randomUUID(),
            type: "text",
            role: "assistant",
            content: data.content,
          };
          setItems((prev) => [...prev, assistantItem]);
          speak(data.content);
        }

        if (data.calendarEvents?.length > 0) {
          const calItems: CalendarItem[] = data.calendarEvents.map((ev) => ({
            id: crypto.randomUUID(),
            type: "calendar",
            ...ev,
          }));
          setItems((prev) => [...prev, ...calItems]);
        }
      } catch {
        setItems((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            type: "text",
            role: "assistant",
            content: "Something went wrong. Try again in a moment.",
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [items, isLoading]
  );

  async function startRecording() {
    if (isRecording || isLoading) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);
        setIsTranscribing(true);

        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const form = new FormData();
        form.append("audio", blob, "recording.webm");

        try {
          const res = await fetch("/api/transcribe", { method: "POST", body: form });
          const { text } = await res.json();
          if (text?.trim()) {
            await sendMessage(text.trim());
          }
        } catch {
          // silently fail; user can type instead
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      alert("Microphone access is required for voice input.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  const isInputBusy = isLoading || isTranscribing;

  return (
    <div className="flex flex-col h-screen bg-[#080812]">
      {/* Header */}
      <header className="flex items-center gap-3 px-5 py-4 border-b border-[#1a1a35] shrink-0">
        <Link href="/" className="flex items-center gap-3 hover:opacity-70 transition-opacity">
          <Moon className="w-5 h-5 text-violet-400" strokeWidth={1.5} />
          <span className="text-[#c8c8e4] font-light tracking-widest text-sm">Ruminate</span>
        </Link>
        {isSpeaking && (
          <button
            onClick={stopSpeaking}
            className="ml-auto flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors"
          >
            <VolumeX className="w-3.5 h-3.5" />
            Stop reading
          </button>
        )}
        {!isSpeaking && items.some((i) => i.type === "text" && (i as TextMessage).role === "assistant") && (
          <Volume2 className="ml-auto w-3.5 h-3.5 text-[#444466]" />
        )}
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-8 space-y-4 max-w-2xl mx-auto w-full">
        {items.length === 0 && <WelcomeState />}

        {items.map((item) => {
          if (item.type === "calendar") {
            return <CalendarCard key={item.id} event={item} />;
          }
          return <MessageBubble key={item.id} message={item} />;
        })}

        {isInputBusy && <LoadingBubble label={isTranscribing ? "Transcribing..." : undefined} />}
      </div>

      {/* Input bar */}
      <div className="shrink-0 px-4 pb-8 pt-3 border-t border-[#1a1a35]">
        <div className="flex items-end gap-3 max-w-2xl mx-auto">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What's going through your mind…"
            disabled={isInputBusy}
            rows={1}
            className="flex-1 bg-[#0f0f22] text-[#e0e0f4] rounded-2xl px-4 py-3 resize-none outline-none border border-[#1e1e3a] focus:border-violet-700/50 text-sm leading-relaxed placeholder-[#44446a] disabled:opacity-40 transition-colors"
            style={{ minHeight: "48px", maxHeight: "120px" }}
          />

          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isInputBusy}
            className="p-3 rounded-full bg-violet-800/70 hover:bg-violet-700 disabled:opacity-25 transition-all shrink-0 border border-violet-700/30"
            aria-label="Send"
          >
            <Send className="w-4 h-4 text-[#d4d0ff]" />
          </button>

          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isTranscribing || isLoading}
            className={`p-3 rounded-full transition-all shrink-0 border ${
              isRecording
                ? "bg-red-600 border-red-500/50 mic-pulse"
                : "bg-[#12122a] border-[#1e1e3a] hover:border-violet-700/40 hover:bg-[#18183a]"
            } disabled:opacity-25`}
            aria-label={isRecording ? "Stop recording" : "Start recording"}
          >
            {isRecording ? (
              <MicOff className="w-4 h-4 text-white" />
            ) : (
              <Mic className="w-4 h-4 text-violet-400" />
            )}
          </button>
        </div>

        {isRecording && (
          <p className="text-center text-red-400 text-xs mt-2 fade-up">
            Recording — tap to stop
          </p>
        )}
        {isTranscribing && (
          <p className="text-center text-[#7a7a9a] text-xs mt-2 fade-up">
            Transcribing your voice…
          </p>
        )}
      </div>
    </div>
  );
}

function WelcomeState() {
  return (
    <div className="text-center py-20 fade-up">
      <Moon className="w-10 h-10 text-violet-600/30 mx-auto mb-5" strokeWidth={1} />
      <p className="text-[#555575] text-sm leading-relaxed max-w-xs mx-auto">
        Can&apos;t sleep? That&apos;s okay.
        <br />
        Tell me what&apos;s on your mind — or press the mic and just talk.
      </p>
    </div>
  );
}

function MessageBubble({ message }: { message: TextMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex fade-up ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[82%] px-4 py-3 text-sm leading-relaxed rounded-2xl ${
          isUser
            ? "bg-violet-900/50 text-[#ddddf8] border border-violet-800/30 rounded-br-md"
            : "bg-[#0f0f22] text-[#c8c8e0] border border-[#1a1a35] rounded-bl-md"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}

function CalendarCard({ event }: { event: CalendarItem }) {
  return (
    <div className="flex justify-center fade-up">
      <div className="bg-[#0d0d24] border border-violet-900/50 rounded-2xl px-5 py-4 max-w-sm w-full">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-3.5 h-3.5 text-violet-400" />
          <span className="text-violet-400 text-xs font-medium uppercase tracking-widest">
            Calendar reminder
          </span>
        </div>
        <p className="text-[#e0e0f4] text-sm font-medium mb-1">{event.title}</p>
        <p className="text-[#666688] text-xs mb-4">
          {event.date} &nbsp;at&nbsp; {event.time}
          {event.duration_minutes ? ` · ${event.duration_minutes} min` : ""}
        </p>
        <a
          href={event.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full text-center py-2 px-4 bg-violet-800/60 hover:bg-violet-700/80 text-[#d4d0ff] text-xs rounded-xl transition-colors border border-violet-700/30"
        >
          Add to Google Calendar
        </a>
      </div>
    </div>
  );
}

function LoadingBubble({ label }: { label?: string }) {
  return (
    <div className="flex justify-start fade-up">
      <div className="bg-[#0f0f22] border border-[#1a1a35] rounded-2xl rounded-bl-md px-5 py-4">
        {label ? (
          <p className="text-[#555575] text-xs">{label}</p>
        ) : (
          <div className="flex gap-1.5 items-center">
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="w-1.5 h-1.5 rounded-full bg-violet-500/50 animate-bounce"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
