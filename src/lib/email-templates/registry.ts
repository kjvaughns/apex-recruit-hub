import type { ComponentType } from 'react'

import { template as applicationLicensed } from './application-licensed'
import { template as applicationUnlicensed } from './application-unlicensed'
import { template as welcomeHired } from './welcome-hired'
import { template as followupCheckin } from './followup-checkin'
import { template as welcomeOnboarding } from './welcome-onboarding'
import { template as onboardingComplete } from './onboarding-complete'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  'application-licensed': applicationLicensed,
  'application-unlicensed': applicationUnlicensed,
  'welcome-hired': welcomeHired,
  'followup-checkin': followupCheckin,
  'welcome-onboarding': welcomeOnboarding,
  'onboarding-complete': onboardingComplete,
}
