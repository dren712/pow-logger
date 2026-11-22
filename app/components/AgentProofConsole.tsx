'use client'

import React, { useState } from 'react'
import SiteNav from './SiteNav'
import AuditPanel from './agent-console/AuditPanel'
import CommitmentsCard from './agent-console/CommitmentsCard'
import EventInspector from './agent-console/EventInspector'
import EventList, { type EventFlag } from './agent-console/EventList'
import ExecutionHeader from './agent-console/ExecutionHeader'
import SimulationPanel from './agent-console/SimulationPanel'
import VerificationSteps from './agent-console/VerificationSteps'
import '../styles/agent-console.css'
import type {
  AgentReceipt,
  VerificationResult,
  ExecutionAuditReport,
  ExecutionPolicy,
} from '../lib/agent/types'
import {
  evaluateExecutionPolicy,
  STANDARD_POLICY_PRESETS,
  SECURE_CODING_AGENT_POLICY,
} from '../lib/agent/agentPolicyEngine'
import { generateHostileAgentReceipt } from '../lib/agent/demoExecutionGenerator'

interface AgentProofConsoleProps {
  initialReceipt: AgentReceipt
  initialVerification: VerificationResult
  isLiveDbRecord?: boolean
  /** Set when the requested execution was not found and the example is shown instead. */
  missingExecutionId?: string
  /** Hostile-agent example generated on the server; its generator needs Node's crypto. */
  hostileReceipt?: AgentReceipt
}

const VERIFY_ERROR = 'The verification service could not be reached, so the verdict shown may be out of date. Reset the simulation and try again.'

async function verifyRemote(receipt: AgentReceipt): Promise<VerificationResult | null> {
  try {
    const res = await fetch('/api/agent/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receipt }),
    })
    const result = await res.json()
    return result && result.layers ? (result as VerificationResult) : null
  } catch (e) {
    console.error(e)
    return null
  }
}

export default function AgentProofConsole({
  initialReceipt,
  initialVerification,
  isLiveDbRecord = false,
  missingExecutionId,
  hostileReceipt: serverHostileReceipt,
}: AgentProofConsoleProps) {
  const [receipt, setReceipt] = useState<AgentReceipt>(initialReceipt)
  const [verification, setVerification] = useState<VerificationResult>(initialVerification)
  const [selectedEventIndex, setSelectedEventIndex] = useState<number>(3)
  const [isTampered, setIsTampered] = useState<boolean>(false)
  const [isHostileSimulated, setIsHostileSimulated] = useState<boolean>(false)
  const [selectedPolicyKey, setSelectedPolicyKey] = useState<string>('SECURE_CODING_AGENT')
  const [activeTab, setActiveTab] = useState<'PROVENANCE' | 'AUDIT'>('PROVENANCE')
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState<boolean>(false)

  const activePolicy: ExecutionPolicy = STANDARD_POLICY_PRESETS[selectedPolicyKey] || SECURE_CODING_AGENT_POLICY
  const audit: ExecutionAuditReport = evaluateExecutionPolicy(receipt, activePolicy)

  // Toggle Tampering Attack (Simulation A: Database Intrusion)
  const handleToggleTamper = async () => {
    setIsVerifying(true)
    setVerifyError(null)
    if (!isTampered) {
      setIsHostileSimulated(false)
      const tamperedEvents = initialReceipt.events.map((ev) => {
        if (ev.sequence === 3 || ev.eventType === 'git.operation') {
          return {
            ...ev,
            payload: {
              type: ev.eventType,
              ...(ev.payload || {}),
              commitHash: 'fake999_malicious_override',
              author: 'Attacker <hacker@evil.com>',
            },
            payloadHash: '687a3e5419e6d340e4f1a2387b99c0112233445566778899aabbccddeeff0011',
          }
        }
        return ev
      })

      const tamperedReceipt: AgentReceipt = {
        ...initialReceipt,
        events: tamperedEvents,
      }

      setReceipt(tamperedReceipt)
      setIsTampered(true)
      setSelectedEventIndex(3)

      const result = await verifyRemote(tamperedReceipt)
      if (result) setVerification(result)
      else setVerifyError(VERIFY_ERROR)
    } else {
      setReceipt(initialReceipt)
      setIsTampered(false)
      setVerification(initialVerification)
    }
    setIsVerifying(false)
  }

  // Toggle Hostile Action (Simulation B: Policy Violation with VALID Provenance)
  const handleToggleHostile = async () => {
    setIsVerifying(true)
    setVerifyError(null)
    if (!isHostileSimulated) {
      let hostileReceipt: AgentReceipt
      try {
        hostileReceipt = serverHostileReceipt ?? generateHostileAgentReceipt()
      } catch (e) {
        console.error(e)
        setVerifyError('The hostile agent example could not be generated in this browser. Reload the page and try again.')
        setIsVerifying(false)
        return
      }
      setIsTampered(false)
      setReceipt(hostileReceipt)
      setIsHostileSimulated(true)
      setSelectedEventIndex(2) // Focus on the rm -rf / event

      const result = await verifyRemote(hostileReceipt)
      if (result) setVerification(result)
      else setVerifyError(VERIFY_ERROR)
    } else {
      setReceipt(initialReceipt)
      setIsHostileSimulated(false)
      setVerification(initialVerification)
      setSelectedEventIndex(3)
    }
    setIsVerifying(false)
  }

  const events = receipt.events
  const selectedEvent = events[selectedEventIndex] || events[0]
  const selectedIndex = selectedEvent ? events.indexOf(selectedEvent) : -1
  const failures = verification.failures || []

  const flags: Record<number, EventFlag | undefined> = {}
  events.forEach((ev, idx) => {
    const isTamperedEvent = isTampered && (ev.sequence === 3 || ev.eventType === 'git.operation')
    const isHostileEvent =
      isHostileSimulated &&
      (String(ev.payload?.command || '').includes('rm -rf') ||
        String(ev.payload?.path || '').includes('.env') ||
        String(ev.payload?.tool || '').includes('prod.database'))
    if (isTamperedEvent) flags[idx] = { tone: 'bad', label: 'Tampered' }
    else if (failures.some((f) => f.eventSequence === ev.sequence)) flags[idx] = { tone: 'bad', label: 'Failed' }
    else if (isHostileEvent || audit.findings.some((f) => f.eventSequence === ev.sequence)) flags[idx] = { tone: 'warn', label: 'Flagged' }
  })

  const downloadReceipt = () => {
    const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `provn-agent-receipt-${receipt.execution.executionId.slice(0, 8)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const inspectEvent = (eventSequence: number) => {
    const idx = events.findIndex((ev) => ev.sequence === eventSequence)
    setSelectedEventIndex(idx >= 0 ? idx : eventSequence)
    setActiveTab('PROVENANCE')
  }

  return (
    <div className="pv flex flex-1 flex-col">
      <SiteNav cta={false} />
      <main className="pv-main mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-5 py-8 sm:py-10">
        {!isLiveDbRecord ? (
          <p className="ac-notice ac-notice-info" role="note">
            <span className="font-semibold text-white">Example data. </span>
            {missingExecutionId ? (
              <>
                No stored execution matches <code className="pv-mono ac-break text-[12.5px]">{missingExecutionId}</code>, so a generated example
                is shown in its place.{' '}
              </>
            ) : null}
            This execution is generated for demonstration. The signatures and hashes are real and are verified on this page; the Solana and Irys
            references are placeholders.
          </p>
        ) : null}

        <ExecutionHeader
          receipt={receipt}
          verification={verification}
          audit={audit}
          isLiveDbRecord={isLiveDbRecord}
          onDownload={downloadReceipt}
        />

        {!verification.verified && failures.length > 0 ? (
          <div role="alert" className="ac-notice ac-notice-bad">
            <p className="font-semibold text-white">
              Verification failed: {failures.length} {failures.length === 1 ? 'problem' : 'problems'} found
            </p>
            <ul className="mt-1 list-disc pl-5">
              {failures.slice(0, 5).map((f, i) => (
                <li key={`${f.type}-${i}`}>
                  {f.eventSequence !== null ? `Event #${String(f.eventSequence).padStart(2, '0')}: ` : ''}
                  {f.message}
                </li>
              ))}
            </ul>
            {failures.length > 5 ? <p className="mt-1">And {failures.length - 5} more. Export the receipt to see them all.</p> : null}
          </div>
        ) : null}

        <VerificationSteps receipt={receipt} verification={verification} />

        <SimulationPanel
          receipt={receipt}
          verification={verification}
          audit={audit}
          isTampered={isTampered}
          isHostileSimulated={isHostileSimulated}
          isVerifying={isVerifying}
          verifyError={verifyError}
          onToggleTamper={handleToggleTamper}
          onToggleHostile={handleToggleHostile}
        />

        <div className="flex flex-col gap-5">
          <div role="tablist" aria-label="Execution views" className="ac-tabs">
            <button
              type="button"
              role="tab"
              id="ac-tab-provenance"
              aria-controls="ac-panel-provenance"
              aria-selected={activeTab === 'PROVENANCE'}
              className="ac-tab"
              onClick={() => setActiveTab('PROVENANCE')}
            >
              Timeline and proofs
            </button>
            <button
              type="button"
              role="tab"
              id="ac-tab-audit"
              aria-controls="ac-panel-audit"
              aria-selected={activeTab === 'AUDIT'}
              className="ac-tab"
              onClick={() => setActiveTab('AUDIT')}
            >
              Policy audit
              {audit.findings.length > 0 ? (
                <span className="ac-pill ac-bad !px-2 before:!hidden" aria-label={`${audit.findings.length} findings`}>
                  {audit.findings.length}
                </span>
              ) : null}
            </button>
          </div>

          {activeTab === 'PROVENANCE' ? (
            <div role="tabpanel" id="ac-panel-provenance" aria-labelledby="ac-tab-provenance" className="flex flex-col gap-4">
              <CommitmentsCard receipt={receipt} isLiveDbRecord={isLiveDbRecord} />
              {selectedEvent ? (
                <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
                  <EventList events={events} selectedIndex={selectedIndex} flags={flags} onSelect={setSelectedEventIndex} />
                  <EventInspector
                    event={selectedEvent}
                    merkleRoot={receipt.merkle.root}
                    merkleValid={verification.layers.merkleInclusion !== 'INVALID'}
                    failures={failures.filter((f) => f.eventSequence === selectedEvent.sequence)}
                  />
                </div>
              ) : (
                <div className="pv-card px-6 py-12 text-center">
                  <p className="text-[16px] font-semibold text-white">No events recorded</p>
                  <p className="pv-muted mx-auto mt-2 max-w-md text-[14px] leading-relaxed">
                    This execution has no signed events yet. Events appear here once the agent logs its first action.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div role="tabpanel" id="ac-panel-audit" aria-labelledby="ac-tab-audit">
              <AuditPanel
                audit={audit}
                activePolicy={activePolicy}
                selectedPolicyKey={selectedPolicyKey}
                onSelectPolicy={setSelectedPolicyKey}
                onInspectEvent={inspectEvent}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
