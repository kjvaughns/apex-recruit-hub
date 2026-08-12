/** Server-only transcription (AssemblyAI) + AI training notes (Lovable AI).
 *  Never import this from client-reachable module scope. */

const AAI = "https://api.assemblyai.com/v2/transcript";

function key(): string {
  const k = process.env["ASSEMBLY_API_KEY"];
  if (!k) throw new Error("Transcription isn't configured yet. Add the transcription API key and try again.");
  return k;
}

/** Confirm the media is actually fetchable before handing it to AssemblyAI. */
export async function assertMediaReachable(url: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(url, { method: "GET", headers: { Range: "bytes=0-1023" }, redirect: "follow" });
  } catch {
    throw new Error("We couldn't reach that media link from the server. Make sure it's publicly accessible.");
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      "That link is private. In Google Drive open Share → General access → \"Anyone with the link\", then paste the link again.",
    );
  }
  if (!res.ok && res.status !== 206) {
    throw new Error(`That link returned an error (${res.status}). Check the URL and sharing settings.`);
  }
  const type = res.headers.get("content-type") ?? "";
  if (/text\/html/i.test(type)) {
    throw new Error(
      "That link points at a web page, not a media file. In Google Drive use Share → Copy link on the file itself (not a folder), or upload the file to Vantage Academy.",
    );
  }
  try {
    await res.body?.cancel();
  } catch {
    /* ignore */
  }
}

export async function submitTranscription(mediaUrl: string): Promise<string> {
  await assertMediaReachable(mediaUrl);
  const res = await fetch(AAI, {
    method: "POST",
    headers: { authorization: key(), "content-type": "application/json" },
    body: JSON.stringify({ audio_url: mediaUrl, punctuate: true, format_text: true }),
  });
  const body = await res.text();
  if (!res.ok) {
    console.error(`AssemblyAI submit failed [${res.status}]: ${body}`);
    throw new Error(`Transcription service rejected the request (${res.status}).`);
  }
  const json = JSON.parse(body) as { id?: string };
  if (!json.id) throw new Error("Transcription service did not return a job id.");
  return json.id;
}

export type ProviderTranscript = {
  status: "queued" | "processing" | "completed" | "failed";
  text: string | null;
  segments: { start: number; end: number; text: string }[] | null;
  error: string | null;
};

export async function fetchTranscription(jobId: string): Promise<ProviderTranscript> {
  const res = await fetch(`${AAI}/${jobId}`, { headers: { authorization: key() } });
  const body = await res.text();
  if (!res.ok) {
    console.error(`AssemblyAI poll failed [${res.status}]: ${body}`);
    throw new Error(`Couldn't check transcription status (${res.status}).`);
  }
  const j = JSON.parse(body) as any;
  const status = j.status === "error" ? "failed" : (j.status as ProviderTranscript["status"]);
  const segments =
    Array.isArray(j.words) && j.words.length
      ? groupWords(j.words as { start: number; end: number; text: string }[])
      : null;
  return { status, text: j.text ?? null, segments, error: j.error ?? null };
}

/** Collapse word timings into ~20s readable paragraphs with timestamps. */
function groupWords(words: { start: number; end: number; text: string }[]) {
  const out: { start: number; end: number; text: string }[] = [];
  let cur: { start: number; end: number; text: string[] } | null = null;
  for (const w of words) {
    if (!cur) cur = { start: w.start, end: w.end, text: [w.text] };
    else {
      cur.text.push(w.text);
      cur.end = w.end;
    }
    if (cur.end - cur.start > 20000) {
      out.push({ start: cur.start, end: cur.end, text: cur.text.join(" ") });
      cur = null;
    }
  }
  if (cur) out.push({ start: cur.start, end: cur.end, text: cur.text.join(" ") });
  return out;
}

export type TrainingNotes = {
  summary: string;
  key_takeaways: string[];
  sales_concepts: string[];
  script_examples: string[];
  objections: string[];
  action_items: string[];
  moments: { timestamp: string; title: string; detail: string }[];
};

const EMPTY_NOTES: TrainingNotes = {
  summary: "",
  key_takeaways: [],
  sales_concepts: [],
  script_examples: [],
  objections: [],
  action_items: [],
  moments: [],
};

/** Structured training notes from a transcript. Returns null when no AI key is configured. */
export async function generateTrainingNotes(
  title: string,
  transcript: string,
  timedTranscript?: string,
): Promise<TrainingNotes | null> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return null;

  const prompt = `You are creating internal training notes for insurance sales agents from a recorded training called "${title}".

Return STRICT JSON with this exact shape (no markdown, no commentary):
{
  "summary": "2-4 sentence plain summary",
  "key_takeaways": ["..."],
  "sales_concepts": ["..."],
  "script_examples": ["exact language an agent can say"],
  "objections": ["objection discussed - how it was handled"],
  "action_items": ["..."],
  "moments": [{"timestamp":"14:32","title":"Price Objection","detail":"1-2 sentences"}]
}

Only include moments when the timestamped transcript supports them. Never invent content that is not in the transcript. Keep every item short and practical.

TRANSCRIPT:
${(timedTranscript || transcript).slice(0, 90000)}`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const body = await res.text();
  if (!res.ok) {
    console.error(`AI notes failed [${res.status}]: ${body}`);
    throw new Error(`Couldn't generate training notes (${res.status}).`);
  }
  const content: string = JSON.parse(body)?.choices?.[0]?.message?.content ?? "";
  const cleaned = content.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as Partial<TrainingNotes>;
    return {
      ...EMPTY_NOTES,
      ...parsed,
      key_takeaways: parsed.key_takeaways ?? [],
      sales_concepts: parsed.sales_concepts ?? [],
      script_examples: parsed.script_examples ?? [],
      objections: parsed.objections ?? [],
      action_items: parsed.action_items ?? [],
      moments: parsed.moments ?? [],
      summary: parsed.summary ?? "",
    };
  } catch {
    return { ...EMPTY_NOTES, summary: cleaned.slice(0, 4000) };
  }
}
