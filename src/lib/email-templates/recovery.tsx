import * as React from 'react'
import { Text } from '@react-email/components'

import { FAINT, GoldButton, Shell, paragraph } from './_shell'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ siteName, confirmationUrl }: RecoveryEmailProps) => (
  <Shell
    preview={`Reset your password for ${siteName}`}
    title="Reset your password"
    footerNote="You're receiving this because a password reset was requested for this email address."
  >
    <Text style={paragraph}>
      Use the button below to choose a new password for your Vantage Financial account.
    </Text>
    <GoldButton href={confirmationUrl} label="Reset password" />
    <Text style={{ ...paragraph, color: FAINT, fontSize: '13px' }}>
      If you didn&apos;t request a reset, you can safely ignore this email — your password
      stays unchanged.
    </Text>
  </Shell>
)

export default RecoveryEmail
