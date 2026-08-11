import * as React from 'react'
import { Text } from '@react-email/components'

import { CARD, FAINT, GOLD, INK, Shell, paragraph } from './_shell'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Shell
    preview="Your Vantage Financial verification code"
    title="Confirm it's you"
    footerNote="You're receiving this because a sensitive action was requested on your account."
  >
    <Text style={paragraph}>Use the code below to confirm your identity:</Text>
    <Text style={code}>{token}</Text>
    <Text style={{ ...paragraph, color: FAINT, fontSize: '13px' }}>
      This code expires shortly. If you didn&apos;t request it, you can safely ignore this
      email.
    </Text>
  </Shell>
)

export default ReauthenticationEmail

const code: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: CARD,
  border: `1px solid ${GOLD}`,
  borderRadius: '10px',
  padding: '14px 24px',
  margin: '8px 0 20px',
  fontSize: '28px',
  fontWeight: 700,
  letterSpacing: '6px',
  color: INK,
  fontFamily: 'Menlo, Consolas, monospace',
}
