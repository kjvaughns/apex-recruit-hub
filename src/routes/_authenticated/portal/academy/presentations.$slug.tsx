import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell } from "@/components/vantage/portal-shell";
import {
  PageBody,
  Panel,
  Button,
  Badge,
  EmptyState,
  ErrorState,
  CardSkeleton,
  Tabs,
} from "@/components/portal/ui";
import { getRecordingLearner } from "@/lib/academy-content.functions";
import { resolveMedia } from "@/lib/academy/media";
import { NotesPreview } from "@/components/vantage/academy/media-fields";
import { ChevronLeft } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/portal/academy/presentations/$slug")({
  head: () => ({
    meta: [
      { title: "Recorded presentation — Vantage Academy" },
      { name: "description", content: "Watch a recorded Vantage training and review the AI training notes." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RecordingPage,
});

function RecordingPage() {
  const { slug } = Route.useParams();
  const getFn = useServerFn(getRecordingLearner);
  const q = useQuery({ queryKey: ["academy", "recording", slug], queryFn: () => getFn({ data: { slug } }) });
  const [tab, setTab] = useState<"notes" | "transcript">("notes");

  if (q.isError)
    return (
      <PortalShell>
        <PageBody>
          <ErrorState description="We couldn't load this recording. Please try again." onRetry={() => q.refetch()} />
        </PageBody>
      </PortalShell>
    );

  if (q.isLoading)
    return (
      <PortalShell>
        <PageBody>
          <CardSkeleton lines={6} />
        </PageBody>
      </PortalShell>
    );

  const data = q.data && q.data.found ? q.data : null;
  if (!data)
    return (
      <PortalShell>
        <PageBody>
          <EmptyState
            title="Recording not found"
            description="This recording may be unpublished or the link is wrong."
            action={
              <Link to="/portal/academy" search={{ section: "presentations" }}>
                <Button variant="secondary" size="sm">Back to Academy</Button>
              </Link>
            }
          />
        </PageBody>
      </PortalShell>
    );

  const rec = data.recording as any;
  const transcript = data.transcript as any;
  const media = resolveMedia(rec.video_url);
  const isAudio = rec.format === "audio";

  return (
    <PortalShell>
      <PageBody>
        <Link
          to="/portal/academy"
          search={{ section: "presentations" }}
          className="p-focus mb-4 inline-flex items-center gap-1 text-[13px]"
          style={{ color: "var(--p-text-2)" }}
        >
          <ChevronLeft size={15} /> Recorded presentations
        </Link>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
          <div className="min-w-0 space-y-4">
            {isAudio ? (
              <Panel>
                {rec.video_url ? (
                  <audio controls src={media.embedUrl ?? rec.video_url} className="w-full" />
                ) : (
                  <div className="p-muted">No audio attached yet.</div>
                )}
              </Panel>
            ) : (
              <div className="p-panel overflow-hidden">
                {!rec.video_url ? (
                  <div className="grid aspect-video place-items-center" style={{ background: "var(--p-raised)", color: "var(--p-text-3)" }}>
                    No video attached yet
                  </div>
                ) : media.kind === "direct" ? (
                  <video controls src={rec.video_url} className="aspect-video w-full" style={{ background: "var(--p-raised)" }} />
                ) : (
                  <iframe
                    src={media.embedUrl ?? rec.video_url}
                    title={rec.title}
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    className="aspect-video w-full"
                    style={{ border: 0, background: "var(--p-raised)" }}
                  />
                )}
              </div>
            )}

            <Panel
              title={rec.title}
              description={[rec.presenter?.name, rec.presenter_role || rec.presenter?.role].filter(Boolean).join(" · ")}
              actions={
                <div className="flex items-center gap-2">
                  {rec.topic && <Badge tone="blue">{rec.topic}</Badge>}
                  {rec.duration && <span className="p-muted">{rec.duration}</span>}
                </div>
              }
            >
              {rec.description ? (
                <p className="p-secondary whitespace-pre-wrap leading-relaxed">{rec.description}</p>
              ) : (
                <p className="p-muted">No description for this recording.</p>
              )}
            </Panel>
          </div>

          <Panel title="Training notes" padded={false}>
            <div className="px-4 pt-3">
              <Tabs
                value={tab}
                onChange={setTab}
                items={[
                  { value: "notes", label: "AI notes" },
                  { value: "transcript", label: "Transcript" },
                ]}
              />
            </div>
            <div className="p-4">
              {tab === "notes" ? (
                transcript?.notes ? (
                  <NotesPreview notes={transcript.notes} />
                ) : (
                  <p className="p-muted leading-snug">
                    Training notes appear here once this recording has been transcribed.
                  </p>
                )
              ) : transcript?.transcript_text ? (
                <div
                  className="p-secondary max-h-[520px] overflow-y-auto whitespace-pre-wrap rounded-[10px] p-3 leading-relaxed"
                  style={{ background: "var(--p-hover)" }}
                >
                  {transcript.transcript_text}
                </div>
              ) : (
                <p className="p-muted leading-snug">No transcript for this recording yet.</p>
              )}
            </div>
          </Panel>
        </div>
      </PageBody>
    </PortalShell>
  );
}
