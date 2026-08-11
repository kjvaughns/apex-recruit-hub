import * as React from 'react'
import { Text } from '@react-email/components'

import { FAINT, GoldButton, Shell, paragraph } from './_shell'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ siteName, confirmationUrl }: MagicLinkEmailProps) => (
  <Shell
    preview={`Your login link for ${siteName}`}
    title="Your login link"
    footerNote="You're receiving this because a sign-in link was requested for this email address."
  >
    <Text style={paragraph}>
      Use the secure link below to sign in to the Vantage Financial portal.
    </Text>
    <GoldButton href={confirmationUrl} label="Sign in" />
    <Text style={{ ...paragraph, color: FAINT, fontSize: '13px' }}>
      This link expires shortly and can only be used once. If you didn&apos;t request it, you
      can safely ignore this email.
    </Text>
  </Shell>
)

export default MagicLinkEmail
