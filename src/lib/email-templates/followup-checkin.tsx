import * as React from 'react'
import { Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { GoldButton, Shell, bullet, greet, links, paragraph, GOLD, type EmailLinkProps } from './_shell'

interface Props extends EmailLinkProps {
  firstName?: string
}

const TITLE = "Quick check-in — how's the course going?"

const Bullet = ({ children }: { children: React.ReactNode }) => (
  <Text style={bullet}>
    <span style={{ color: GOLD, fontWeight: 700 }}>&#10003;</span>&nbsp;&nbsp;{children}
  </Text>
)

const Email = ({ firstName, ...rest }: Props) => {
  const L = links(rest)
  return (
    <Shell preview={TITLE} title={TITLE}>
      <Text style={paragraph}>
        Hey {greet(firstName)}, checking in on your licensing progress.
      </Text>
      <Text style={paragraph}>Where are you at with the course right now? A few quick things:</Text>
      <Bullet>Still working through the material? Keep the momentum going.</Bullet>
      <Bullet>
        Haven&apos;t posted in the #unlicensed Discord yet? Drop your &ldquo;I got the
        course&rdquo; screenshot.
      </Bullet>
      <Bullet>Stuck on anything? Just reply to this email — we&apos;ve got you.</Bullet>
      <GoldButton href={L.discordInviteUrl} label="Open the Discord" />
      <Text style={paragraph}>You&apos;re closer than you think. Let&apos;s keep pushing.</Text>
    </Shell>
  )
}

export const template = {
  component: Email,
  subject: TITLE,
  displayName: 'Pre-licensing check-in',
  previewData: { firstName: 'Jordan' },
} satisfies TemplateEntry
