"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Moon, Mic, MicOff, Send, Calendar, VolumeX } from "lucide-react";
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
    <div className="flex flex-col h-screen bg-[#030307]">
      {/* Header */}
      <header className="flex items-center gap-2.5 px-6 py-5 shrink-0">
        <Link href="/" className="flex items-center gap-2.5 opacity-40 hover:opacity-70 transition-opacity">
          <Moon className="w-4 h-4 text-violet-300" strokeWidth={1.5} />
          <span className="text-[#aaaacc] font-light tracking-widest text-xs uppercase">Ruminate</span>
        </Link>
        {isSpeaking && (
          <button
            onClick={stopSpeaking}
            className="ml-auto opacity-40 hover:opacity-70 transition-opacity"
            aria-label="Stop speaking"
          >
            <VolumeX className="w-3.5 h-3.5 text-violet-300" />
          </button>
        )}
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-6 max-w-xl mx-auto w-full">
        {items.length === 0 && <WelcomeState />}

        {items.map((item) => {
          if (item.type === "calendar") {
            return <CalendarCard key={item.id} event={item} />;
          }
          return <MessageBubble key={item.id} message={item} />;
        })}

        {isInputBusy && <LoadingBubble transcribing={isTranscribing} />}
      </div>

      {/* Input bar */}
      <div className="shrink-0 px-6 pb-8 pt-4 max-w-xl mx-auto w-full">
        <div className="flex items-end gap-4">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What's going through your mind…"
            disabled={isInputBusy}
            rows={1}
            className="flex-1 bg-transparent text-[#c0c0d8] text-sm leading-relaxed resize-none outline-none placeholder-[#333348] disabled:opacity-30 transition-opacity"
            style={{ minHeight: "28px", maxHeight: "120px" }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isInputBusy}
            className="opacity-30 hover:opacity-80 disabled:opacity-10 transition-opacity shrink-0 pb-0.5"
            aria-label="Send"
          >
            <Send className="w-4 h-4 text-violet-300" />
          </button>
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isTranscribing || isLoading}
            className={`shrink-0 pb-0.5 transition-all ${
              isRecording ? "opacity-100 mic-pulse" : "opacity-30 hover:opacity-80"
            } disabled:opacity-10`}
            aria-label={isRecording ? "Stop recording" : "Start recording"}
          >
            {isRecording ? (
              <MicOff className="w-4 h-4 text-red-400" />
            ) : (
              <Mic className="w-4 h-4 text-violet-300" />
            )}
          </button>
        </div>
        {/* Thin separator line */}
        <div className="mt-3 h-px bg-[#111120]" />
      </div>
    </div>
  );
}

function WelcomeState() {
  return (
    <div className="text-center pt-24 fade-up">
      <p className="text-[#2e2e48] text-sm leading-loose">
        Can&apos;t sleep? Tell me what&apos;s spinning.
      </p>
    </div>
  );
}

function MessageBubble({ message }: { message: TextMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex fade-up ${isUser ? "justify-end" : "justify-start"}`}>
      {isUser ? (
        <div className="max-w-[78%] px-3.5 py-2.5 bg-[#0c0c1e] text-[#9090b8] text-sm leading-relaxed rounded-2xl rounded-br-sm">
          {message.content}
        </div>
      ) : (
        <p className="max-w-[88%] text-[#6a6a8a] text-sm leading-loose">
          {message.content}
        </p>
      )}
    </div>
  );
}

function CalendarCard({ event }: { event: CalendarItem }) {
  return (
    <div className="fade-up">
      <div className="border border-[#111128] rounded-xl px-4 py-3.5 max-w-xs">
        <div className="flex items-center gap-1.5 mb-2 opacity-40">
          <Calendar className="w-3 h-3 text-violet-300" />
          <span className="text-violet-300 text-xs tracking-widest uppercase">reminder</span>
        </div>
        <p className="text-[#888898] text-sm mb-0.5">{event.title}</p>
        <p className="text-[#333348] text-xs mb-3">
          {event.date} · {event.time}
          {event.duration_minutes ? ` · ${event.duration_minutes}m` : ""}
        </p>
        <a
          href={event.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-violet-400/60 hover:text-violet-300 text-xs transition-colors"
        >
          Add to Google Calendar →
        </a>
      </div>
    </div>
  );
}

function LoadingBubble({ transcribing }: { transcribing: boolean }) {
  return (
    <div className="flex justify-start fade-up">
      {transcribing ? (
        <p className="text-[#2e2e48] text-xs">transcribing…</p>
      ) : (
        <div className="flex gap-1.5 items-center pt-1">
          {[0, 160, 320].map((delay) => (
            <span
              key={delay}
              className="w-1 h-1 rounded-full bg-[#333350] animate-bounce"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
