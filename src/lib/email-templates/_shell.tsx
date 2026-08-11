import * as React from 'react'
import { DISCORD_INVITE_URL, XCEL_COURSE_URL } from '@/lib/next-steps'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

export const GOLD = '#C9A84C'
export const CARD = '#141414'
export const INK = '#F5F1E6'
export const MUTED = '#B8B4A8'
export const FAINT = '#8C8A84'

/** Links used across the Vantage emails. All optional with safe fallbacks. */
export interface EmailLinkProps {
  overviewUrl?: string
  ownerCalendlyUrl?: string
  courseUrl?: string
  discordInviteUrl?: string
  /**
   * When set, this render is the recruiting agent's copy of an email that was
   * sent to the named applicant. Shell renders a banner saying so.
   */
  copyFor?: string
}


type ResolvedLinks = Required<Omit<EmailLinkProps, 'copyFor'>>

export const FALLBACK_LINKS: ResolvedLinks = {
  overviewUrl: 'https://vantage-financial.net/apply',
  ownerCalendlyUrl: 'https://vantage-financial.net/apply',
  courseUrl: XCEL_COURSE_URL,
  discordInviteUrl: DISCORD_INVITE_URL,
}


const main: React.CSSProperties = {
  backgroundColor: '#ffffff',
  margin: 0,
  padding: '28px 12px',
  fontFamily: 'Arial, Helvetica, sans-serif',
}

const card: React.CSSProperties = {
  maxWidth: '560px',
  margin: '0 auto',
  backgroundColor: CARD,
  borderRadius: '16px',
  overflow: 'hidden',
}

const inner: React.CSSProperties = { padding: '30px 34px 26px 34px' }

const wordmark: React.CSSProperties = {
  margin: '0 0 6px 0',
  letterSpacing: '3px',
  fontSize: '15px',
  fontWeight: 800,
  color: GOLD,
}

const footerStyle: React.CSSProperties = {
  padding: '18px 34px 28px 34px',
  fontSize: '12px',
  lineHeight: '1.6',
  color: FAINT,
  margin: 0,
}

const hr: React.CSSProperties = {
  borderColor: 'rgba(255,255,255,0.09)',
  margin: 0,
}

export const heading: React.CSSProperties = {
  margin: '6px 0 14px 0',
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: '26px',
  lineHeight: '1.15',
  color: INK,
}

export const paragraph: React.CSSProperties = {
  margin: '0 0 14px 0',
  fontSize: '15px',
  lineHeight: '1.6',
  color: MUTED,
}

export const bullet: React.CSSProperties = {
  margin: '0 0 8px 0',
  fontSize: '14.5px',
  lineHeight: '1.5',
  color: INK,
}

export const buttonStyle: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: GOLD,
  borderRadius: '10px',
  padding: '14px 26px',
  fontSize: '15px',
  fontWeight: 700,
  color: '#141414',
  textDecoration: 'none',
}

export function GoldButton({ href, label }: { href: string; label: string }) {
  return (
    <Section style={{ margin: '20px 0' }}>
      <Button href={href} style={buttonStyle}>
        {label} &rarr;
      </Button>
    </Section>
  )
}

export function Shell({
  preview,
  title,
  footerNote,
  children,
}: {
  preview: string
  title: string
  /** Overrides the default recruiting footer line (use for account/auth emails). */
  footerNote?: string
  children: React.ReactNode
}) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={card}>
          <Section style={inner}>
            <Text style={wordmark}>VANTAGE FINANCIAL</Text>
            <Heading style={heading}>{title}</Heading>
            {children}
          </Section>
          <Hr style={hr} />
          <Text style={footerStyle}>
            &copy; 2026 Vantage Financial.{' '}
            {footerNote ??
              "You're receiving this because you applied to join the Vantage team."}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export function greet(name?: string) {
  return name && name.trim() ? name.trim() : 'there'
}

export function links(p: EmailLinkProps): ResolvedLinks {
  const pick = (v: string | undefined, fallback: string) =>
    v && v.trim() && v.trim() !== "#" ? v.trim() : fallback;
  return {
    overviewUrl: pick(p.overviewUrl, FALLBACK_LINKS.overviewUrl),
    ownerCalendlyUrl: pick(p.ownerCalendlyUrl, FALLBACK_LINKS.ownerCalendlyUrl),
    courseUrl: pick(p.courseUrl, FALLBACK_LINKS.courseUrl),
    discordInviteUrl: pick(p.discordInviteUrl, FALLBACK_LINKS.discordInviteUrl),
  }
}
