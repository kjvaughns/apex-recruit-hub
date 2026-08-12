import * as React from 'react'
import { Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { GoldButton, Shell, greet, paragraph, bullet, GOLD } from './_shell'

interface Props {
  firstName?: string
  portalLink?: string
  /** Recruiting agent's copy — names the applicant this went to. */
  copyFor?: string
}

const TITLE = "Welcome to the team — let's get you set up"

const Step = ({ label }: { label: string }) => (
  <Text style={bullet}>
    <span style={{ color: GOLD, fontWeight: 700 }}>&#10003;</span>&nbsp;&nbsp;{label}
  </Text>
)

const Email = ({ firstName, portalLink, copyFor }: Props) => (
  <Shell preview={TITLE} title={TITLE} copyFor={copyFor}>
    <Text style={paragraph}>
      Congrats {greet(firstName)} — you&apos;re officially on board as a licensed Vantage agent.
      Welcome.
    </Text>
    <Text style={paragraph}>
      First, create your agent portal account. Your information is already filled in — confirm your
      NPN and choose a password to open your onboarding checklist:
    </Text>
    <GoldButton href={portalLink || '#'} label="Create my agent account" />
    <Text style={paragraph}>Here&apos;s what&apos;s waiting for you — four quick steps:</Text>
    <Step label="AgentSpace contracting" />
    <Step label="Discord role update" />
    <Step label="Portal setup" />
    <Step label="Expectations review" />
    <Text style={paragraph}>Knock these out and you&apos;re fully onboarded. Let&apos;s build.</Text>
  </Shell>
)

export const template = {
  component: Email,
  subject: TITLE,
  displayName: 'Welcome to onboarding',
  previewData: { firstName: 'Jordan', portalLink: 'https://vantage-financial.net/portal-invite/sample-token' },
} satisfies TemplateEntry
