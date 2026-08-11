import * as React from 'react'
import { Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { Shell, greet, paragraph } from './_shell'

interface Props {
  firstName?: string
}

const TITLE = "You're fully onboarded — welcome to training"

const Email = ({ firstName }: Props) => (
  <Shell preview={TITLE} title={TITLE}>
    <Text style={paragraph}>
      Nice work, {greet(firstName)} — every onboarding step is done. You&apos;re officially set up
      and a real part of the Vantage team.
    </Text>
    <Text style={paragraph}>
      Next up is training. Your training path will be available in the portal shortly — we&apos;ll
      let you know the moment it&apos;s live.
    </Text>
    <Text style={paragraph}>Welcome aboard. This is where it gets good.</Text>
  </Shell>
)

export const template = {
  component: Email,
  subject: TITLE,
  displayName: 'Onboarding complete',
  previewData: { firstName: 'Jordan' },
} satisfies TemplateEntry
