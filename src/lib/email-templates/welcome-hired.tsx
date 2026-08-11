import * as React from 'react'
import { Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { GoldButton, Shell, greet, links, paragraph, INK, type EmailLinkProps } from './_shell'

interface Props extends EmailLinkProps {
  firstName?: string
  licensed?: boolean
}

const TITLE = "Welcome to Vantage — you're officially on the team"

const Email = ({ firstName, licensed, ...rest }: Props) => {
  const L = links(rest)
  return (
    <Shell preview={TITLE} title={TITLE}>
      <Text style={paragraph}>
        Congrats {greet(firstName)} — you&apos;re officially on the Vantage team. This is the
        start of something big.
      </Text>
      {licensed ? (
        <Text style={paragraph}>
          Since you&apos;re already licensed, your next step is contracting paperwork. Someone
          from the team will follow up shortly with those details — keep an eye on your inbox
          and phone.
        </Text>
      ) : (
        <>
          <Text style={paragraph}>
            Your one job right now: get licensed. If you haven&apos;t grabbed your course yet,
            do it today:
          </Text>
          <GoldButton href={L.courseUrl} label="Get your course" />
          <Text style={paragraph}>
            Once you&apos;re in the course, post a screenshot in our{' '}
            <strong style={{ color: INK }}>#unlicensed</strong> Discord channel with the caption
            &ldquo;I got the course&rdquo; so we can track your progress:
          </Text>
          <GoldButton href={L.discordInviteUrl} label="Join the Discord" />
          <Text style={paragraph}>
            We&apos;ll check in with you every week until you&apos;re licensed. Let&apos;s get
            it.
          </Text>
        </>
      )}
    </Shell>
  )
}

export const template = {
  component: Email,
  subject: TITLE,
  displayName: "Welcome — you're hired",
  previewData: { firstName: 'Jordan', licensed: false },
} satisfies TemplateEntry
