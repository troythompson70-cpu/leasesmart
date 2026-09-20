/**
 * SharePoint 00 Lead Intake writer. Never sends SMTP / Exchange mail.
 * Does not mark VERIFIED. Uses existing Graph env names only.
 */
import {
  GRAPH_ENV_NAMES,
  graphAuthReady,
  missingGraphEnv,
  writeJsonToLeadIntake,
  type GraphEnvName,
} from './graph-sharepoint.ts'

export {
  GRAPH_ENV_NAMES,
  graphAuthReady,
  missingGraphEnv,
}

export const CANONICAL_SITE = 'TEAM TGT MSP'
export const CANONICAL_LEAD_INTAKE =
  'Shared Documents/General/TGT REVENUE COMMAND CENTER/00 Lead Intake'

export type SharePointIntakeResult =
  | {
      ok: true
      fileName: string
      path: string
      itemId: string
      webUrl: string
    }
  | {
      ok: false
      error: string
      missingEnv: GraphEnvName[]
    }

function leadFileName(requestType: string, requestId: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const safeType = requestType.replace(/[^a-z0-9_-]/gi, '') || 'intake'
  return `TGT_LEAD_${safeType}_${stamp}_${requestId.slice(0, 8)}.json`
}

/**
 * Write a validated intake payload to canonical 00 Lead Intake.
 * Never invents a SharePoint file name on failure.
 */
export async function writeLeadToSharePoint(input: {
  payload: unknown
  requestType: string
  requestId: string
}): Promise<SharePointIntakeResult> {
  const missing = missingGraphEnv()
  if (missing.length > 0) {
    return {
      ok: false,
      error:
        'SharePoint 00 Lead Intake write blocked: Graph env vars are not present in this process.',
      missingEnv: missing,
    }
  }

  const fileName = leadFileName(input.requestType, input.requestId)
  try {
    const item = await writeJsonToLeadIntake({
      fileName,
      body: {
        schemaVersion: '1.1',
        verificationState: 'NOT_VERIFIED',
        requestType: input.requestType,
        requestId: input.requestId,
        payload: input.payload,
        writtenAt: new Date().toISOString(),
        canonicalPath: CANONICAL_LEAD_INTAKE,
      },
    })
    return {
      ok: true,
      fileName: item.name,
      path: item.path,
      itemId: item.id,
      webUrl: item.webUrl,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      ok: false,
      error: message,
      missingEnv: [],
    }
  }
}
