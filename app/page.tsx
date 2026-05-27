import Link from "next/link";
import { Moon } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#080812] flex flex-col items-center justify-center relative overflow-hidden">
      {/* Soft glow orbs */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-violet-950/60 blur-3xl breathe pointer-events-none" />
      <div
        className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full bg-indigo-950/40 blur-3xl breathe pointer-events-none"
        style={{ animationDelay: "2.5s" }}
      />

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-md">
        <div className="mb-8 flex justify-center">
          <Moon className="w-14 h-14 text-violet-400 opacity-80" strokeWidth={1.25} />
        </div>

        <h1 className="text-5xl font-extralight text-[#e8e8f4] mb-4 tracking-widest">
          Ruminate
        </h1>

        <p className="text-[#7a7a9a] text-base leading-relaxed mb-12">
          Can&apos;t sleep? Tell it what&apos;s spinning in your head.
          <br />
          It listens, gently untangles, and helps you rest.
        </p>

        <Link href="/chat">
          <button className="px-10 py-4 bg-violet-800/70 hover:bg-violet-700/80 text-[#e0e0f4] rounded-full text-base font-light tracking-wide transition-all duration-200 hover:scale-105 border border-violet-600/25 shadow-xl shadow-violet-950/50 cursor-pointer">
            Start talking
          </button>
        </Link>

        <p className="text-[#444466] text-xs mt-10 tracking-wide">
          Free &nbsp;·&nbsp; Voice or text &nbsp;·&nbsp; No judgment
        </p>
      </div>
    </main>
  );
}
