import * as React from 'react'
import { Link, Text } from '@react-email/components'

import { FAINT, GOLD, GoldButton, Shell, paragraph } from './_shell'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Shell
    preview={`Confirm your email for ${siteName}`}
    title="Confirm your email"
    footerNote="You're receiving this because an account was created with this email address."
  >
    <Text style={paragraph}>
      Thanks for creating your{' '}
      <Link href={siteUrl} style={{ color: GOLD, textDecoration: 'none' }}>
        <strong>Vantage Financial</strong>
      </Link>{' '}
      account.
    </Text>
    <Text style={paragraph}>
      Confirm <strong style={{ color: GOLD }}>{recipient}</strong> to activate your access.
    </Text>
    <GoldButton href={confirmationUrl} label="Verify email" />
    <Text style={{ ...paragraph, color: FAINT, fontSize: '13px' }}>
      If you didn&apos;t create an account, you can safely ignore this email.
    </Text>
  </Shell>
)

export default SignupEmail
