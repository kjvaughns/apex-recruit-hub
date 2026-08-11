import * as React from 'react'
import { Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { GoldButton, Shell, greet, paragraph, bullet, GOLD } from './_shell'

interface Props {
  firstName?: string
  portalLink?: string
}

const TITLE = "Welcome to the team — let's get you set up"

const Step = ({ label }: { label: string }) => (
  <Text style={bullet}>
    <span style={{ color: GOLD, fontWeight: 700 }}>&#10003;</span>&nbsp;&nbsp;{label}
  </Text>
)

const Email = ({ firstName, portalLink }: Props) => (
  <Shell preview={TITLE} title={TITLE}>
    <Text style={paragraph}>
      Congrats {greet(firstName)} — you&apos;re officially on board as a licensed Vantage agent.
      Welcome.
    </Text>
    <Text style={paragraph}>
      Your first stop is the agent portal. That&apos;s where you&apos;ll find your full onboarding
      checklist — log in and knock it out:
    </Text>
    <GoldButton href={portalLink || '#'} label="Open your portal" />
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
  previewData: { firstName: 'Jordan', portalLink: 'https://vantage-financial.net/portal' },
} satisfies TemplateEntry
