/**
 * The Vantage email catalog — every email the platform can send, defined as
 * data (subject + body copy with `{{tokens}}`) so one renderer, one brand
 * shell, and one admin editor cover all of them.
 *
 * Client-safe: pure data. No secrets, no server imports.
 */

import type { EmailVarKey } from "./vars";

export type EmailAudience = "applicant" | "agent";

export type EmailCategory =
  | "security"
  | "account"
  | "recruiting"
  | "follow_up"
  | "onboarding"
  | "training"
  | "meeting"
  | "announcement"
  | "campaign";

/** Notification preference that gates an optional email. */
export type PrefKey =
  | "recruiting_updates"
  | "applicant_follow_ups"
  | "training_reminders"
  | "meeting_reminders"
  | "agency_announcements"
  | "onboarding_updates";

export interface EmailDetail {
  label: string;
  value: string;
}

export interface EmailBody {
  title: string;
  intro?: string;
  lines?: string[];
  bullets?: string[];
  details?: EmailDetail[];
  ctaLabel?: string;
  ctaUrl?: string;
  note?: string;
}

export interface EmailTemplateDef {
  name: string;
  label: string;
  audience: EmailAudience;
  category: EmailCategory;
  /** Human description of what fires this email. */
  trigger: string;
  /** Optional emails are gated on this preference. Security emails have none. */
  prefKey?: PrefKey;
  /** Never auto-send — recruiter picks it from the Send Email composer. */
  manualOnly?: boolean;
  subject: string;
  body: EmailBody;
}

const GREET = "Hi {{first_name}},";

function def(d: EmailTemplateDef): EmailTemplateDef {
  return d;
}

/* ------------------------------------------------------------------ */
/* Applicant / recruiting                                              */
/* ------------------------------------------------------------------ */

const applicantTemplates: EmailTemplateDef[] = [
  def({
    name: "application-licensed",
    label: "Application received — licensed",
    audience: "applicant",
    category: "recruiting",
    trigger: "A licensed applicant submits the application",
    subject: "Your Vantage Financial application is in",
    body: {
      title: "Application received",
      intro: GREET,
      lines: [
        "Thanks for applying to {{agency_name}}. Because you're already licensed, the next step is a short interview with our team.",
        "Pick a time that works and we'll go through the opportunity, comp, and what your first 30 days look like.",
      ],
      ctaLabel: "Book your interview",
      ctaUrl: "{{overview_link}}",
      note: "Questions before then? Just reply to this email.",
    },
  }),
  def({
    name: "application-unlicensed",
    label: "Application received — unlicensed",
    audience: "applicant",
    category: "recruiting",
    trigger: "An unlicensed applicant submits the application",
    subject: "Your Vantage Financial application is in",
    body: {
      title: "Application received",
      intro: GREET,
      lines: [
        "Thanks for applying to {{agency_name}}. Your next step is our company overview — that's where you'll see exactly how this works before you spend a dollar.",
      ],
      bullets: [
        "Attend the company overview",
        "Start your licensing course when you're ready",
        "Join the Vantage Discord so you're plugged in",
      ],
      ctaLabel: "Confirm your overview",
      ctaUrl: "{{overview_link}}",
      note: "Licensing course: {{course_link}}",
    },
  }),
  def({
    name: "evaluation-request",
    label: "Evaluation request",
    audience: "applicant",
    category: "recruiting",
    trigger: "A recruiter requests the evaluation from the applicant record",
    subject: "Next step: your Vantage evaluation",
    body: {
      title: "One quick evaluation",
      intro: GREET,
      lines: [
        "Before we move forward, take five minutes to complete your evaluation. It tells us how to set you up for a fast start.",
      ],
      ctaLabel: "Start your evaluation",
      ctaUrl: "{{evaluation_link}}",
    },
  }),
  def({
    name: "interview-confirmation",
    label: "Interview confirmation",
    audience: "applicant",
    category: "recruiting",
    trigger: "An interview is booked (Calendly) for a licensed applicant",
    subject: "You're booked — Vantage interview details",
    body: {
      title: "Your interview is confirmed",
      intro: GREET,
      lines: ["Here are your details. Take the call somewhere quiet with a strong signal."],
      details: [
        { label: "Date", value: "{{interview_date}}" },
        { label: "Time", value: "{{interview_time}}" },
        { label: "With", value: "{{recruiter_name}}" },
      ],
      ctaLabel: "Open your portal",
      ctaUrl: "{{portal_link}}",
      note: "Need to move it? Reply here and we'll sort it out.",
    },
  }),
  def({
    name: "interview-reminder",
    label: "Interview reminder (24h)",
    audience: "applicant",
    category: "recruiting",
    trigger: "24 hours before a scheduled interview",
    subject: "Reminder: your Vantage interview is tomorrow",
    body: {
      title: "See you tomorrow",
      intro: GREET,
      lines: ["Quick reminder about your interview with {{agency_name}}."],
      details: [
        { label: "Date", value: "{{interview_date}}" },
        { label: "Time", value: "{{interview_time}}" },
      ],
      note: "If something came up, reply and we'll reschedule.",
    },
  }),
  def({
    name: "overview-confirmation",
    label: "Overview confirmation",
    audience: "applicant",
    category: "recruiting",
    trigger: "An overview slot is confirmed for an unlicensed applicant",
    subject: "You're registered for the Vantage overview",
    body: {
      title: "Your overview is confirmed",
      intro: GREET,
      lines: ["This is the call where everything makes sense. Show up with questions."],
      details: [
        { label: "Date", value: "{{overview_date}}" },
        { label: "Time", value: "{{overview_time}}" },
      ],
      ctaLabel: "Join the Vantage Discord",
      ctaUrl: "{{discord_link}}",
    },
  }),
  def({
    name: "overview-reminder",
    label: "Overview reminder (24h)",
    audience: "applicant",
    category: "recruiting",
    trigger: "24 hours before a scheduled overview",
    subject: "Reminder: Vantage overview tomorrow",
    body: {
      title: "Your overview is tomorrow",
      intro: GREET,
      lines: ["Here's your reminder for the {{agency_name}} company overview."],
      details: [
        { label: "Date", value: "{{overview_date}}" },
        { label: "Time", value: "{{overview_time}}" },
      ],
    },
  }),
  def({
    name: "reschedule-confirmation",
    label: "Reschedule confirmation",
    audience: "applicant",
    category: "recruiting",
    trigger: "An applicant reschedules through Calendly",
    subject: "Updated — your new Vantage time",
    body: {
      title: "Your time has been updated",
      intro: GREET,
      lines: ["No problem. Here's the new time on our calendar."],
      details: [
        { label: "Date", value: "{{interview_date}}" },
        { label: "Time", value: "{{interview_time}}" },
      ],
    },
  }),
  def({
    name: "followup-checkin",
    label: "Follow up",
    audience: "applicant",
    category: "follow_up",
    trigger: "Recruiter follow-up, manual or from a task",
    subject: "Still interested in Vantage?",
    body: {
      title: "Checking in",
      intro: GREET,
      lines: [
        "I wanted to make sure you didn't get stuck. If you're still interested, the next step is quick.",
      ],
      ctaLabel: "Pick a time",
      ctaUrl: "{{overview_link}}",
    },
  }),
  def({
    name: "reschedule-followup",
    label: "Reschedule follow up",
    audience: "applicant",
    category: "follow_up",
    trigger: "Manual — applicant cancelled and hasn't rebooked",
    subject: "Let's get you back on the calendar",
    body: {
      title: "Let's find a new time",
      intro: GREET,
      lines: ["Life happens. Grab whatever time works best for you and we'll take it from there."],
      ctaLabel: "Choose a new time",
      ctaUrl: "{{overview_link}}",
    },
  }),
  def({
    name: "no-show-followup",
    label: "No show follow up",
    audience: "applicant",
    category: "follow_up",
    trigger: "Manual — applicant missed their call",
    manualOnly: true,
    subject: "Missed you today",
    body: {
      title: "We missed you",
      intro: GREET,
      lines: [
        "We had you down for a call today and didn't connect. If you're still interested, rebook and we'll pick up where we left off.",
      ],
      ctaLabel: "Rebook your call",
      ctaUrl: "{{overview_link}}",
    },
  }),
  def({
    name: "accepted",
    label: "Accepted",
    audience: "applicant",
    category: "recruiting",
    trigger: "Applicant is marked hired",
    subject: "You're in — welcome to Vantage Financial",
    body: {
      title: "You're in",
      intro: GREET,
      lines: [
        "Congratulations — you've been accepted to {{agency_name}}. Your next steps are waiting in the portal.",
      ],
      ctaLabel: "Get started",
      ctaUrl: "{{portal_link}}",
    },
  }),
  def({
    name: "welcome-hired",
    label: "Welcome (hired)",
    audience: "applicant",
    category: "onboarding",
    trigger: "Applicant enters onboarding",
    subject: "Welcome to Vantage Financial",
    body: {
      title: "Welcome to the team",
      intro: GREET,
      lines: [
        "Everything you need lives in the agent portal — onboarding checklist, training, resources, and the team calendar.",
      ],
      bullets: [
        "Finish your onboarding checklist",
        "Complete the Vantage Closer Course",
        "Get on Discord and introduce yourself",
      ],
      ctaLabel: "Open the portal",
      ctaUrl: "{{portal_link}}",
    },
  }),
  def({
    name: "licensing-instructions",
    label: "Licensing instructions",
    audience: "applicant",
    category: "onboarding",
    trigger: "Applicant enters the licensing stage",
    subject: "Your licensing next steps",
    body: {
      title: "Let's get you licensed",
      intro: GREET,
      lines: [
        "Your licensing course is the gate to everything else, so start it today and work it daily.",
      ],
      bullets: [
        "Enroll in the licensing course",
        "Study daily — most agents finish in two to three weeks",
        "Tell your recruiter the day you pass",
      ],
      ctaLabel: "Start your course",
      ctaUrl: "{{course_link}}",
    },
  }),
  def({
    name: "licensing-reminder",
    label: "Licensing reminder",
    audience: "applicant",
    category: "onboarding",
    trigger: "Applicant has been in licensing without progress",
    subject: "How's the licensing course going?",
    body: {
      title: "Checking on your course",
      intro: GREET,
      lines: [
        "Quick nudge on your licensing course. Consistent daily study is what gets people through fast.",
      ],
      ctaLabel: "Back to your course",
      ctaUrl: "{{course_link}}",
    },
  }),
  def({
    name: "onboarding-invitation",
    label: "Onboarding invitation",
    audience: "applicant",
    category: "onboarding",
    trigger: "Portal account is created for a new agent",
    subject: "Set up your Vantage agent portal",
    body: {
      title: "Your portal account is ready",
      intro: GREET,
      lines: [
        "Set your password and you'll land straight in your onboarding checklist.",
      ],
      ctaLabel: "Set up your account",
      ctaUrl: "{{invitation_link}}",
      note: "This link is unique to you — please don't forward it.",
    },
  }),
  def({
    name: "training-instructions",
    label: "Training instructions",
    audience: "applicant",
    category: "training",
    trigger: "Applicant or agent enters training",
    subject: "Your Vantage training starts now",
    body: {
      title: "Training time",
      intro: GREET,
      lines: [
        "The Vantage Closer Course comes before live training — finish it first so live sessions actually land.",
      ],
      ctaLabel: "Continue training",
      ctaUrl: "{{academy_link}}",
    },
  }),
  def({
    name: "first-day-reminder",
    label: "First day reminder",
    audience: "applicant",
    category: "onboarding",
    trigger: "Day before an agent's first day",
    subject: "Your first day at Vantage",
    body: {
      title: "Tomorrow's your first day",
      intro: GREET,
      lines: ["Show up ready to dial. Everything you need is in the portal."],
      ctaLabel: "Open the portal",
      ctaUrl: "{{portal_link}}",
    },
  }),
  def({
    name: "not-moving-forward",
    label: "Not moving forward",
    audience: "applicant",
    category: "recruiting",
    trigger: "Manual only — recruiter sends from the applicant record",
    manualOnly: true,
    subject: "An update on your Vantage application",
    body: {
      title: "Thank you for your time",
      intro: GREET,
      lines: [
        "After reviewing your application, we're not moving forward at this time. That isn't a judgement on you — it's about fit for where the team is right now.",
        "We appreciate the time you gave us and wish you well.",
      ],
    },
  }),
  def({
    name: "welcome-onboarding",
    label: "Onboarding started",
    audience: "applicant",
    category: "onboarding",
    trigger: "Onboarding checklist is created",
    prefKey: "onboarding_updates",
    subject: "Your Vantage onboarding checklist",
    body: {
      title: "Your onboarding checklist",
      intro: GREET,
      lines: ["Five steps and you're fully set up. Knock them out in one sitting if you can."],
      ctaLabel: "Continue onboarding",
      ctaUrl: "{{onboarding_link}}",
    },
  }),
  def({
    name: "onboarding-complete",
    label: "Onboarding complete",
    audience: "applicant",
    category: "onboarding",
    trigger: "Agent completes every onboarding step",
    prefKey: "onboarding_updates",
    subject: "Onboarding complete — you're ready",
    body: {
      title: "Onboarding complete",
      intro: GREET,
      lines: ["Every step is done. Now it's about reps — training, dials, and film review."],
      ctaLabel: "Open the portal",
      ctaUrl: "{{portal_link}}",
    },
  }),
  def({
    name: "onboarding-reminder",
    label: "Onboarding reminder",
    audience: "agent",
    category: "onboarding",
    trigger: "Onboarding incomplete after 24h of no progress (capped series)",
    prefKey: "onboarding_updates",
    subject: "Finish your Vantage onboarding",
    body: {
      title: "You're partway there",
      intro: GREET,
      lines: ["A few steps left before you're fully set up."],
      details: [
        { label: "Progress", value: "{{progress}}" },
        { label: "Next step", value: "{{next_step}}" },
      ],
      ctaLabel: "Continue onboarding",
      ctaUrl: "{{onboarding_link}}",
    },
  }),
];

/* ------------------------------------------------------------------ */
/* Agent / account                                                     */
/* ------------------------------------------------------------------ */

const agentTemplates: EmailTemplateDef[] = [
  def({
    name: "portal-invitation",
    label: "Agent portal invitation",
    audience: "agent",
    category: "account",
    trigger: "An invitation is created or resent",
    subject: "You're invited to the Vantage agent portal",
    body: {
      title: "Your invitation",
      intro: GREET,
      lines: ["{{recruiter_name}} invited you to the {{agency_name}} agent portal."],
      ctaLabel: "Accept your invitation",
      ctaUrl: "{{invitation_link}}",
      note: "This invitation is unique to you and expires in 14 days.",
    },
  }),
  def({
    name: "password-changed",
    label: "Password changed",
    audience: "agent",
    category: "security",
    trigger: "An agent changes their password",
    subject: "Your Vantage password was changed",
    body: {
      title: "Password changed",
      intro: GREET,
      lines: [
        "Your portal password was just changed. If that wasn't you, reset it immediately and tell your manager.",
      ],
      ctaLabel: "Open the portal",
      ctaUrl: "{{portal_link}}",
    },
  }),
  def({
    name: "email-changed",
    label: "Email address changed",
    audience: "agent",
    category: "security",
    trigger: "An agent changes their email address",
    subject: "Your Vantage email address was changed",
    body: {
      title: "Email address updated",
      intro: GREET,
      lines: ["Your portal email address was updated. If this wasn't you, contact your manager now."],
    },
  }),
  def({
    name: "profile-updated",
    label: "Profile updated",
    audience: "agent",
    category: "account",
    trigger: "An admin changes an agent's profile details",
    subject: "Your Vantage profile was updated",
    body: {
      title: "Profile updated",
      intro: GREET,
      lines: ["An administrator updated your profile details. Take a look and confirm they're right."],
      ctaLabel: "Review your profile",
      ctaUrl: "{{portal_link}}",
    },
  }),
  def({
    name: "training-assigned",
    label: "Training assigned",
    audience: "agent",
    category: "training",
    trigger: "Required training is assigned",
    prefKey: "training_reminders",
    subject: "New training assigned: {{course_name}}",
    body: {
      title: "New training assigned",
      intro: GREET,
      lines: ["{{course_name}} has been assigned to you."],
      details: [{ label: "Due", value: "{{deadline}}" }],
      ctaLabel: "Continue training",
      ctaUrl: "{{academy_link}}",
    },
  }),
  def({
    name: "training-reminder",
    label: "Training reminder",
    audience: "agent",
    category: "training",
    trigger: "Required training still incomplete before its deadline",
    prefKey: "training_reminders",
    subject: "Reminder: finish {{course_name}}",
    body: {
      title: "Training reminder",
      intro: GREET,
      lines: ["{{course_name}} is still open. The Closer Course is required before live training."],
      details: [{ label: "Due", value: "{{deadline}}" }],
      ctaLabel: "Continue training",
      ctaUrl: "{{academy_link}}",
    },
  }),
  def({
    name: "course-completed",
    label: "Course completed",
    audience: "agent",
    category: "training",
    trigger: "An agent completes a course",
    prefKey: "training_reminders",
    subject: "Nice work — {{course_name}} complete",
    body: {
      title: "Course complete",
      intro: GREET,
      lines: ["You finished {{course_name}}. Keep the momentum going."],
      ctaLabel: "Next lesson",
      ctaUrl: "{{academy_link}}",
    },
  }),
  def({
    name: "certification-passed",
    label: "Certification passed",
    audience: "agent",
    category: "training",
    trigger: "An agent passes a certification quiz",
    prefKey: "training_reminders",
    subject: "Certified — {{course_name}}",
    body: {
      title: "You passed",
      intro: GREET,
      lines: ["You passed {{course_name}} with {{score}}."],
      ctaLabel: "Back to the Academy",
      ctaUrl: "{{academy_link}}",
    },
  }),
  def({
    name: "certification-retake",
    label: "Certification needs retake",
    audience: "agent",
    category: "training",
    trigger: "An agent misses the passing score on a certification",
    prefKey: "training_reminders",
    subject: "One more attempt on {{course_name}}",
    body: {
      title: "Give it another run",
      intro: GREET,
      lines: [
        "You came in at {{score}} on {{course_name}}. Review the lesson and retake it — most people pass on the second attempt.",
      ],
      ctaLabel: "Retake the quiz",
      ctaUrl: "{{academy_link}}",
    },
  }),
  def({
    name: "meeting-reminder",
    label: "Meeting reminder",
    audience: "agent",
    category: "meeting",
    trigger: "24 hours and 1 hour before a calendar event",
    prefKey: "meeting_reminders",
    subject: "Reminder: {{event_name}}",
    body: {
      title: "{{event_name}}",
      intro: GREET,
      lines: ["Here's your reminder."],
      details: [{ label: "When", value: "{{event_when}}" }],
      ctaLabel: "View the calendar",
      ctaUrl: "{{calendar_link}}",
    },
  }),
  def({
    name: "agency-announcement",
    label: "Agency announcement",
    audience: "agent",
    category: "announcement",
    trigger: "An admin sends an announcement",
    prefKey: "agency_announcements",
    subject: "{{subject_line}}",
    body: {
      title: "{{subject_line}}",
      intro: GREET,
      lines: ["{{message}}"],
      ctaLabel: "Open the portal",
      ctaUrl: "{{portal_link}}",
    },
  }),
  def({
    name: "important-notification",
    label: "Important agency notification",
    audience: "agent",
    category: "account",
    trigger: "Admin sends a required operational notice",
    subject: "Important: {{subject_line}}",
    body: {
      title: "{{subject_line}}",
      intro: GREET,
      lines: ["{{message}}"],
      ctaLabel: "Open the portal",
      ctaUrl: "{{portal_link}}",
    },
  }),
  def({
    name: "manager-notification",
    label: "Manager / trainer notification",
    audience: "agent",
    category: "recruiting",
    trigger: "Something in a manager's downline needs attention",
    prefKey: "recruiting_updates",
    subject: "Vantage: {{subject_line}}",
    body: {
      title: "{{subject_line}}",
      intro: GREET,
      lines: ["{{message}}"],
      ctaLabel: "Open the portal",
      ctaUrl: "{{portal_link}}",
    },
  }),
  def({
    name: "applicant-followup-reminder",
    label: "Applicant follow up reminder",
    audience: "agent",
    category: "follow_up",
    trigger: "An applicant needs follow-up today",
    prefKey: "applicant_follow_ups",
    subject: "Follow up with {{applicant_name}}",
    body: {
      title: "Time to follow up",
      intro: GREET,
      lines: ["{{applicant_name}} is waiting on you. A two-minute call beats a week of silence."],
      ctaLabel: "Open the applicant",
      ctaUrl: "{{portal_link}}",
    },
  }),
  def({
    name: "new-agent-assigned",
    label: "New agent assigned",
    audience: "agent",
    category: "recruiting",
    trigger: "An agent is placed under a manager",
    prefKey: "recruiting_updates",
    subject: "New agent on your team: {{applicant_name}}",
    body: {
      title: "New agent assigned",
      intro: GREET,
      lines: ["{{applicant_name}} was added to your team. Reach out today and set expectations."],
      ctaLabel: "View your organization",
      ctaUrl: "{{portal_link}}",
    },
  }),
];

/* ------------------------------------------------------------------ */
/* Campaigns                                                           */
/* ------------------------------------------------------------------ */

const campaignTemplates: EmailTemplateDef[] = [
  def({
    name: "campaign-daily-focus",
    label: "Daily Production Focus",
    audience: "agent",
    category: "campaign",
    trigger: "Daily at 7:00 AM CT for subscribed agents",
    subject: "Today's focus",
    body: {
      title: "Today's production focus",
      intro: GREET,
      details: [
        { label: "Target", value: "{{target}}" },
        { label: "Dial hours", value: "{{dial_hours}}" },
      ],
      lines: ["{{mindset}}", "Today's focus: {{focus}}"],
      ctaLabel: "Open the portal",
      ctaUrl: "{{portal_link}}",
    },
  }),
  def({
    name: "campaign-weekly-game-plan",
    label: "Weekly Vantage Game Plan",
    audience: "agent",
    category: "campaign",
    trigger: "Mondays at 7:00 AM CT",
    subject: "Your Vantage game plan for the week",
    body: {
      title: "This week's game plan",
      intro: GREET,
      details: [
        { label: "Team meeting", value: "{{meeting_time}}" },
        { label: "Agency training", value: "{{training_time}}" },
        { label: "Film review", value: "{{film_review}}" },
        { label: "Dial expectation", value: "{{dial_expectation}}" },
      ],
      lines: ["{{message}}"],
      ctaLabel: "Open the portal",
      ctaUrl: "{{portal_link}}",
    },
  }),
  def({
    name: "campaign-weekly-sales-tip",
    label: "Weekly Sales Tip",
    audience: "agent",
    category: "campaign",
    trigger: "Weekly for subscribed agents",
    subject: "Sales tip: {{tip_title}}",
    body: {
      title: "{{tip_title}}",
      intro: GREET,
      lines: ["{{tip_body}}"],
      ctaLabel: "Study it in the Academy",
      ctaUrl: "{{academy_link}}",
    },
  }),
  def({
    name: "campaign-academy-content",
    label: "New Academy content",
    audience: "agent",
    category: "campaign",
    trigger: "New Academy content is published",
    subject: "New in the Vantage Academy",
    body: {
      title: "New training just dropped",
      intro: GREET,
      lines: ["{{message}}"],
      ctaLabel: "Watch it now",
      ctaUrl: "{{academy_link}}",
    },
  }),
  def({
    name: "campaign-leadership",
    label: "Leadership development",
    audience: "agent",
    category: "campaign",
    trigger: "Weekly for leaders and managers",
    subject: "Leadership note",
    body: {
      title: "Leadership note",
      intro: GREET,
      lines: ["{{message}}"],
      ctaLabel: "Open the portal",
      ctaUrl: "{{portal_link}}",
    },
  }),
];

export const EMAIL_TEMPLATE_LIST: EmailTemplateDef[] = [
  ...applicantTemplates,
  ...agentTemplates,
  ...campaignTemplates,
];

export const EMAIL_CATALOG: Record<string, EmailTemplateDef> = Object.fromEntries(
  EMAIL_TEMPLATE_LIST.map((t) => [t.name, t]),
);

export function templateDef(name: string): EmailTemplateDef | undefined {
  return EMAIL_CATALOG[name];
}

/** Templates a recruiter can pick in the Send Email composer. */
export function composerTemplates(): EmailTemplateDef[] {
  return EMAIL_TEMPLATE_LIST.filter(
    (t) => t.audience === "applicant" && t.category !== "campaign",
  );
}

/** Variable keys a template actually uses, for the editor's help list. */
export function templateVars(t: EmailTemplateDef): string[] {
  const strings = [
    t.subject,
    t.body.title,
    t.body.intro ?? "",
    ...(t.body.lines ?? []),
    ...(t.body.bullets ?? []),
    ...(t.body.details ?? []).flatMap((d) => [d.label, d.value]),
    t.body.ctaUrl ?? "",
    t.body.note ?? "",
  ].join(" ");
  const found = new Set<string>();
  for (const m of strings.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)) found.add(m[1]);
  return [...found] as EmailVarKey[];
}
