import * as React from 'react'
import { Text } from '@react-email/components'

import { FAINT, GOLD, GoldButton, Shell, paragraph } from './_shell'

interface EmailChangeEmailProps {
  siteName: string
  // oldEmail is the user's current address (HookData.OldEmail). For the
  // NEW-recipient half of a secure email_change fanout, `email` equals the
  // recipient (NEW), so the "from" line must render oldEmail to read
  // "from OLD to NEW" instead of "from NEW to NEW".
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Shell
    preview={`Confirm your email change for ${siteName}`}
    title="Confirm your email change"
    footerNote="You're receiving this because an email change was requested on your account."
  >
    <Text style={paragraph}>
      You asked to change the email on your Vantage Financial account from{' '}
      <strong style={{ color: GOLD }}>{oldEmail}</strong> to{' '}
      <strong style={{ color: GOLD }}>{newEmail}</strong>.
    </Text>
    <GoldButton href={confirmationUrl} label="Confirm email change" />
    <Text style={{ ...paragraph, color: FAINT, fontSize: '13px' }}>
      If you didn&apos;t request this change, secure your account immediately by resetting your
      password.
    </Text>
  </Shell>
)

export default EmailChangeEmail
