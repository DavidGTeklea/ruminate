import { groq, WHISPER_MODEL } from "@/lib/groq";

export async function POST(request: Request) {
  const formData = await request.formData();
  const audio = formData.get("audio");

  if (!audio || !(audio instanceof File)) {
    return Response.json({ error: "No audio file provided" }, { status: 400 });
  }

  const transcription = await groq.audio.transcriptions.create({
    file: audio,
    model: WHISPER_MODEL,
    language: "en",
    response_format: "json",
  });

  return Response.json({ text: transcription.text });
}
