import * as React from 'react'
import { Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { GoldButton, Shell, greet, links, paragraph, type EmailLinkProps } from './_shell'

interface Props extends EmailLinkProps {
  firstName?: string
}

const TITLE = "You're in — here's your next step"

const Email = ({ firstName, ...rest }: Props) => {
  const L = links(rest)
  return (
    <Shell preview={TITLE} title={TITLE} copyFor={rest.copyFor}>
      <Text style={paragraph}>
        Hey {greet(firstName)}, we&apos;ve got your application — welcome.
      </Text>
      <Text style={paragraph}>
        Your next step is the Vantage overview call. Book your seat here:
      </Text>
      <GoldButton href={L.overviewUrl} label="Book the overview" />
      <Text style={paragraph}>
        Don&apos;t wait on us to get moving — you can get a head start on licensing today.
        Start the approved Xcel Solutions pre-licensing course now and use partner code{' '}
        <strong>karmakore</strong> at checkout for our discounted rate:
      </Text>
      <GoldButton href={L.courseUrl} label="Start the licensing course" />
      <Text style={paragraph}>
        Then join the Vantage Discord — that&apos;s where training, announcements, and the team live:
      </Text>
      <GoldButton href={L.discordInviteUrl} label="Join the Discord" />
      <Text style={paragraph}>
        After the overview, if it&apos;s a fit, we&apos;ll send you a short form to officially
        join the team. Let&apos;s get to work.
      </Text>
    </Shell>
  )
}


export const template = {
  component: Email,
  subject: TITLE,
  displayName: 'Application received — unlicensed',
  previewData: { firstName: 'Jordan' },
} satisfies TemplateEntry
