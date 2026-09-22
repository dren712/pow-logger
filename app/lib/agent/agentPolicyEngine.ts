/**
 * PROVN Agent Protocol — Layer 3: Deterministic Policy & Audit Engine
 * Protocol Version: agent/1
 *
 * ARCHITECTURAL MANDATE:
 * Strictly separates PROVENANCE ("What happened?") from AUDIT ("Was it okay?").
 *
 * An agent action can be:
 *   - Cryptographically VALID (signed, chained, Merkle batched, Solana anchored)
 *   - AND simultaneously a CRITICAL POLICY VIOLATION (e.g. `rm -rf /` or credential theft)
 *
 * The Policy Engine NEVER alters cryptographic provenance. It deterministically
 * evaluates already-committed events against configurable execution policies
 * and outputs an immutable ExecutionAuditReport with findings and risk metrics.
 */

import type {
  AgentReceipt,
  AgentEvent,
  ExecutionPolicy,
  ExecutionAuditReport,
  AuditFinding,
  AuditSeverity,
  RiskLevel,
  AuditComplianceStatus,
} from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Built-in Policy Presets
// ─────────────────────────────────────────────────────────────────────────────

export const SECURE_CODING_AGENT_POLICY: ExecutionPolicy = {
  policyId: 'provn-pol-secure-coding-v1',
  policyName: 'Secure Coding Agent Guardrails',
  description: 'Permits standard development tasks while strictly forbidding access to secrets, destructive shell commands, and production infrastructure.',
  version: '1.0.0',
  allowedEventTypes: [
    'agent.started',
    'agent.completed',
    'agent.failed',
    'tool.request',
    'tool.response',
    'file.read',
    'file.write',
    'shell.execute',
    'git.operation',
  ],
  forbiddenFilePatterns: [
    '.env',
    '.env.',
    'id_rsa',
    'id_ed25519',
    '.ssh/',
    '/etc/shadow',
    '/etc/passwd',
    'credentials.json',
    'service-account.json',
    'secret',
  ],
  readOnlyFilePatterns: [
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    '.github/workflows/',
  ],
  forbiddenCommands: [
    'rm -rf /',
    'rm -rf *',
    'mkfs',
    'chmod -R 777',
    ':(){ :|:& };:',
    'DROP TABLE',
    'TRUNCATE TABLE',
    'DELETE FROM',
    'curl *production*',
    'wget *production*',
    'export AWS_SECRET',
    'cat /etc/shadow',
  ],
  forbiddenTools: [
    'prod.database.*',
    'aws.iam.*',
    'system.exec_root',
    'kubernetes.cluster_admin',
    'cloud.production.deploy',
  ],
  maxEventCount: 500,
}

export const READ_ONLY_AUDITOR_POLICY: ExecutionPolicy = {
  policyId: 'provn-pol-read-only-v1',
  policyName: 'Read-Only Codebase Auditor',
  description: 'Zero-mutation policy. Restricts agents to inspection actions only. Rejects file writes, shell execution, and deployments.',
  version: '1.0.0',
  allowedEventTypes: [
    'agent.started',
    'agent.completed',
    'agent.failed',
    'file.read',
    'tool.request',
    'tool.response',
  ],
  deniedEventTypes: [
    'file.write',
    'shell.execute',
    'git.operation',
    'deployment.request',
    'deployment.result',
  ],
  forbiddenFilePatterns: [
    '.env',
    '.ssh/',
    'credentials',
    'secret',
  ],
  forbiddenTools: [
    'prod.database.*',
    'aws.*',
  ],
  maxEventCount: 200,
}

export const STRICT_ZERO_TRUST_POLICY: ExecutionPolicy = {
  policyId: 'provn-pol-zero-trust-v1',
  policyName: 'Strict Zero-Trust Infrastructure',
  description: 'Whitelist-only policy requiring explicit authorization for all actions. Flags any deviation as a critical violation.',
  version: '1.0.0',
  allowedEventTypes: [
    'agent.started',
    'agent.completed',
    'file.read',
    'tool.request',
    'tool.response',
  ],
  deniedEventTypes: [
    'file.write',
    'shell.execute',
    'deployment.request',
    'deployment.result',
  ],
  forbiddenFilePatterns: [
    '.env',
    '.git/',
    'config',
    'secrets',
    '/etc/',
  ],
  forbiddenTools: [
    '*',
  ],
  maxEventCount: 50,
}

export const STANDARD_POLICY_PRESETS: Record<string, ExecutionPolicy> = {
  SECURE_CODING_AGENT: SECURE_CODING_AGENT_POLICY,
  READ_ONLY_AUDITOR: READ_ONLY_AUDITOR_POLICY,
  STRICT_ZERO_TRUST: STRICT_ZERO_TRUST_POLICY,
}

// ─────────────────────────────────────────────────────────────────────────────
// Pattern Matchers (Wildcard / Substring / Regex Safe)
// ─────────────────────────────────────────────────────────────────────────────

function matchesPattern(target: string, pattern: string): boolean {
  if (!target || !pattern) return false
  const normTarget = target.toLowerCase()
  const normPattern = pattern.toLowerCase()

  // Wildcard conversion: replace '*' with '.*' safely
  if (normPattern.includes('*')) {
    const escaped = normPattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
    try {
      const regex = new RegExp(`^${escaped}$`, 'i')
      if (regex.test(normTarget)) return true
    } catch {
      // Fallback to substring
    }
  }

  // Exact or substring match
  return normTarget.includes(normPattern)
}

function matchesAnyPattern(target: string, patterns: string[]): string | null {
  for (const pattern of patterns) {
    if (matchesPattern(target, pattern)) {
      return pattern
    }
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Policy Engine Evaluator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deterministically audits a PROVN Agent Receipt against an ExecutionPolicy.
 *
 * This function NEVER relies on an LLM or non-deterministic heuristics.
 * It strictly enforces structural, permission, and parameter constraints.
 *
 * @param receipt The portable PROVN agent receipt (with authentic events)
 * @param policy The execution policy to audit against (defaults to SECURE_CODING_AGENT)
 * @returns Complete ExecutionAuditReport with findings, severity, and risk scoring
 */
export function evaluateExecutionPolicy(
  receipt: AgentReceipt,
  policy: ExecutionPolicy = SECURE_CODING_AGENT_POLICY
): ExecutionAuditReport {
  const findings: AuditFinding[] = []
  const events = receipt.events || []

  // ── 1. Event Type Boundaries ──────────────────────────────────────────────
  for (const ev of events) {
    // Check Allowed Event Types
    if (policy.allowedEventTypes && policy.allowedEventTypes.length > 0) {
      if (!policy.allowedEventTypes.includes(ev.eventType)) {
        findings.push({
          id: `fnd-${ev.sequence}-unauthorized-type`,
          ruleId: 'RULE_UNAUTHORIZED_EVENT_TYPE',
          ruleType: 'ALLOW_DENY_EVENT_TYPES',
          severity: 'VIOLATION',
          riskLevel: 'HIGH',
          eventSequence: ev.sequence,
          eventId: ev.eventId,
          eventType: ev.eventType,
          title: `Unauthorized Event Type: ${ev.eventType}`,
          message: `The agent committed event type '${ev.eventType}' which is disallowed by policy '${policy.policyName}'.`,
          remediation: `Configure the agent execution environment to restrict actions to permitted types: [${policy.allowedEventTypes.join(', ')}].`,
        })
      }
    }

    // Check Denied Event Types
    if (policy.deniedEventTypes && policy.deniedEventTypes.length > 0) {
      if (policy.deniedEventTypes.includes(ev.eventType)) {
        findings.push({
          id: `fnd-${ev.sequence}-denied-type`,
          ruleId: 'RULE_DENIED_EVENT_TYPE',
          ruleType: 'ALLOW_DENY_EVENT_TYPES',
          severity: 'CRITICAL',
          riskLevel: 'CRITICAL',
          eventSequence: ev.sequence,
          eventId: ev.eventId,
          eventType: ev.eventType,
          title: `Explicitly Forbidden Event Type: ${ev.eventType}`,
          message: `The agent performed action '${ev.eventType}' which is blacklisted by policy '${policy.policyName}'.`,
          remediation: `Immediate agent revocation recommended. The agent attempted prohibited operation category.`,
        })
      }
    }

    // ── 2. Payload Inspection ────────────────────────────────────────────────
    evaluateEventPayload(ev, policy, findings)
  }

  // ── 3. Execution Bounds ───────────────────────────────────────────────────
  if (policy.maxEventCount && events.length > policy.maxEventCount) {
    findings.push({
      id: `fnd-bounds-max-events`,
      ruleId: 'RULE_MAX_EVENT_BOUNDS',
      ruleType: 'EXECUTION_BOUNDS',
      severity: 'WARNING',
      riskLevel: 'MEDIUM',
      eventSequence: events.length - 1,
      eventId: events[events.length - 1]?.eventId || 'unknown',
      eventType: 'agent.completed',
      title: 'Execution Event Count Exceeded Policy Limit',
      message: `Execution generated ${events.length} events, exceeding policy threshold of ${policy.maxEventCount}.`,
      remediation: 'Investigate potential looping or resource exhaustion behavior.',
    })
  }

  // ── 4. Risk Scoring & Summary ─────────────────────────────────────────────
  let riskScore = 5 // Baseline low score
  let violationsCount = 0
  let warningsCount = 0
  let infoCount = 0
  let highestSeverity: AuditSeverity = 'INFO'

  for (const f of findings) {
    if (f.severity === 'CRITICAL') {
      riskScore += 45
      violationsCount++
      highestSeverity = 'CRITICAL'
    } else if (f.severity === 'VIOLATION') {
      riskScore += 25
      violationsCount++
      if (highestSeverity !== 'CRITICAL') highestSeverity = 'VIOLATION'
    } else if (f.severity === 'WARNING') {
      riskScore += 10
      warningsCount++
      if (highestSeverity === 'INFO') highestSeverity = 'WARNING'
    } else {
      riskScore += 2
      infoCount++
    }
  }

  riskScore = Math.min(100, Math.max(0, riskScore))

  let overallRisk: RiskLevel = 'LOW'
  if (highestSeverity === 'CRITICAL' || riskScore >= 75) {
    overallRisk = 'CRITICAL'
  } else if (highestSeverity === 'VIOLATION' || riskScore >= 40) {
    overallRisk = 'HIGH'
  } else if (highestSeverity === 'WARNING' || riskScore >= 20) {
    overallRisk = 'MEDIUM'
  }


  let compliance: AuditComplianceStatus = 'COMPLIANT'
  if (violationsCount > 0) {
    compliance = 'VIOLATION'
  } else if (warningsCount > 0) {
    compliance = 'WARNING'
  }

  return {
    policyId: policy.policyId,
    policyName: policy.policyName,
    evaluatedAt: new Date().toISOString(),
    executionId: receipt.execution?.executionId || 'unknown',
    compliance,
    overallRisk,
    riskScore,
    provenanceIntegrity: receipt.execution ? 'VALID' : 'UNVERIFIED',
    findings,
    summary: {
      totalEventsEvaluated: events.length,
      violationsCount,
      warningsCount,
      infoCount,
      highestSeverity,
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Payload Inspector
// ─────────────────────────────────────────────────────────────────────────────

function evaluateEventPayload(
  ev: AgentEvent,
  policy: ExecutionPolicy,
  findings: AuditFinding[]
): void {
  const p = (ev.payload || {}) as Record<string, unknown>

  // ── A. File Operations (file.read, file.write) ─────────────────────────────
  if (ev.eventType === 'file.read' || ev.eventType === 'file.write') {
    const filePath = typeof p.path === 'string' ? p.path : ''

    if (filePath && policy.forbiddenFilePatterns) {
      const match = matchesAnyPattern(filePath, policy.forbiddenFilePatterns)
      if (match) {
        findings.push({
          id: `fnd-${ev.sequence}-forbidden-file`,
          ruleId: 'RULE_FORBIDDEN_FILE_ACCESS',
          ruleType: 'FILE_PATH_CONSTRAINTS',
          severity: 'CRITICAL',
          riskLevel: 'CRITICAL',
          eventSequence: ev.sequence,
          eventId: ev.eventId,
          eventType: ev.eventType,
          title: `Forbidden File Path Accessed: ${filePath}`,
          message: `Agent accessed path matching sensitive pattern '${match}' in ${ev.eventType}.`,
          matchedPattern: match,
          remediation: `Exclude sensitive directories and secrets from agent filesystem sandbox.`,
        })
      }
    }

    if (ev.eventType === 'file.write' && filePath && policy.readOnlyFilePatterns) {
      const match = matchesAnyPattern(filePath, policy.readOnlyFilePatterns)
      if (match) {
        findings.push({
          id: `fnd-${ev.sequence}-readonly-mutation`,
          ruleId: 'RULE_READONLY_FILE_MUTATION',
          ruleType: 'FILE_PATH_CONSTRAINTS',
          severity: 'VIOLATION',
          riskLevel: 'HIGH',
          eventSequence: ev.sequence,
          eventId: ev.eventId,
          eventType: ev.eventType,
          title: `Attempted Write to Protected File: ${filePath}`,
          message: `Agent attempted to modify protected file matching '${match}'.`,
          matchedPattern: match,
          remediation: `Protect infrastructure and configuration files with file locks or branch protection.`,
        })
      }
    }
  }

  // ── B. Shell Executions (shell.execute) ────────────────────────────────────
  if (ev.eventType === 'shell.execute') {
    const command = typeof p.command === 'string' ? p.command : ''

    if (command && policy.forbiddenCommands) {
      const match = matchesAnyPattern(command, policy.forbiddenCommands)
      if (match) {
        findings.push({
          id: `fnd-${ev.sequence}-forbidden-command`,
          ruleId: 'RULE_FORBIDDEN_COMMAND_EXECUTION',
          ruleType: 'FORBIDDEN_COMMAND_PATTERNS',
          severity: 'CRITICAL',
          riskLevel: 'CRITICAL',
          eventSequence: ev.sequence,
          eventId: ev.eventId,
          eventType: ev.eventType,
          title: `Dangerous Shell Command Executed: ${command.slice(0, 40)}`,
          message: `Agent executed high-risk command matching prohibited pattern '${match}'.`,
          matchedPattern: match,
          remediation: `Isolate agent shell environment into an unprivileged container with no sudo access.`,
        })
      }
    }
  }

  // ── C. Tool Invocations (tool.request, tool.response) ──────────────────────
  if (ev.eventType === 'tool.request' || ev.eventType === 'tool.response') {
    const toolName = typeof p.tool === 'string' ? p.tool : (typeof p.toolName === 'string' ? p.toolName : '')

    if (toolName && policy.forbiddenTools) {
      const match = matchesAnyPattern(toolName, policy.forbiddenTools)
      if (match) {
        findings.push({
          id: `fnd-${ev.sequence}-forbidden-tool`,
          ruleId: 'RULE_FORBIDDEN_TOOL_INVOCATION',
          ruleType: 'FORBIDDEN_TOOLS',
          severity: 'CRITICAL',
          riskLevel: 'CRITICAL',
          eventSequence: ev.sequence,
          eventId: ev.eventId,
          eventType: ev.eventType,
          title: `Unauthorized Tool Invoked: ${toolName}`,
          message: `Agent invoked tool matching prohibited namespace '${match}'.`,
          matchedPattern: match,
          remediation: `Revoke agent API permissions to production tool endpoints.`,
        })
      }
    }

    if (toolName && policy.allowedTools && policy.allowedTools.length > 0) {
      const isAllowed = policy.allowedTools.some(t => matchesPattern(toolName, t))
      if (!isAllowed) {
        findings.push({
          id: `fnd-${ev.sequence}-unlisted-tool`,
          ruleId: 'RULE_UNLISTED_TOOL_INVOCATION',
          ruleType: 'FORBIDDEN_TOOLS',
          severity: 'VIOLATION',
          riskLevel: 'HIGH',
          eventSequence: ev.sequence,
          eventId: ev.eventId,
          eventType: ev.eventType,
          title: `Unlisted Tool Invocation: ${toolName}`,
          message: `Agent invoked tool '${toolName}' which is not in the whitelist.`,
          remediation: `Explicitly add required tools to the policy allow list.`,
        })
      }
    }
  }
}
