import * as React from 'react'
import { Link, Text } from '@react-email/components'

import { FAINT, GOLD, GoldButton, Shell, paragraph } from './_shell'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ siteName, siteUrl, confirmationUrl }: InviteEmailProps) => (
  <Shell
    preview={`You've been invited to join ${siteName}`}
    title="You've been invited"
    footerNote="You're receiving this because someone on the Vantage team invited you to the portal."
  >
    <Text style={paragraph}>
      You&apos;ve been invited to the{' '}
      <Link href={siteUrl} style={{ color: GOLD, textDecoration: 'none' }}>
        <strong>Vantage Financial</strong>
      </Link>{' '}
      agent portal.
    </Text>
    <Text style={paragraph}>
      Accept the invitation below to set your password and finish creating your account.
    </Text>
    <GoldButton href={confirmationUrl} label="Accept invitation" />
    <Text style={{ ...paragraph, color: FAINT, fontSize: '13px' }}>
      If you weren&apos;t expecting this invitation, you can safely ignore this email.
    </Text>
  </Shell>
)

export default InviteEmail
