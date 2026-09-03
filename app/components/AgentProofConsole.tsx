'use client'

import React, { useState } from 'react'
import Link from 'next/link'
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
}

export default function AgentProofConsole({
  initialReceipt,
  initialVerification,
  isLiveDbRecord = false,
}: AgentProofConsoleProps) {
  const [receipt, setReceipt] = useState<AgentReceipt>(initialReceipt)
  const [verification, setVerification] = useState<VerificationResult>(initialVerification)
  const [selectedEventIndex, setSelectedEventIndex] = useState<number>(3)
  const [isTampered, setIsTampered] = useState<boolean>(false)
  const [isHostileSimulated, setIsHostileSimulated] = useState<boolean>(false)
  const [selectedPolicyKey, setSelectedPolicyKey] = useState<string>('SECURE_CODING_AGENT')
  const [activeTab, setActiveTab] = useState<'PROVENANCE' | 'AUDIT'>('PROVENANCE')
  const [copiedText, setCopiedText] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState<boolean>(false)

  const activePolicy: ExecutionPolicy = STANDARD_POLICY_PRESETS[selectedPolicyKey] || SECURE_CODING_AGENT_POLICY
  const audit: ExecutionAuditReport = evaluateExecutionPolicy(receipt, activePolicy)

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedText(label)
    setTimeout(() => setCopiedText(null), 2000)
  }

  // Toggle Tampering Attack (Simulation A: Database Intrusion)
  const handleToggleTamper = async () => {
    setIsVerifying(true)
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

      try {
        const res = await fetch('/api/agent/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ receipt: tamperedReceipt }),
        })
        const result = await res.json()
        setVerification(result)
      } catch (e) {
        console.error(e)
      }
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
    if (!isHostileSimulated) {
      setIsTampered(false)
      const hostileReceipt = generateHostileAgentReceipt()
      setReceipt(hostileReceipt)
      setIsHostileSimulated(true)
      setSelectedEventIndex(2) // Focus on the rm -rf / event

      try {
        const res = await fetch('/api/agent/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ receipt: hostileReceipt }),
        })
        const result = await res.json()
        setVerification(result)
      } catch (e) {
        console.error(e)
      }
    } else {
      setReceipt(initialReceipt)
      setIsHostileSimulated(false)
      setVerification(initialVerification)
      setSelectedEventIndex(3)
    }
    setIsVerifying(false)
  }

  const selectedEvent = receipt.events[selectedEventIndex] || receipt.events[0]

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#060709', color: '#f0f3f8', padding: '32px 24px', fontFamily: 'var(--font-geist-mono, monospace)' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>

        {/* Navigation Breadcrumb */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #1a1e28' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link href="/" style={{ color: '#00ff88', textDecoration: 'none', fontSize: '13px', fontWeight: 600 }}>
              PROVN // CONSOLE
            </Link>
            <span style={{ color: '#4a5568' }}>/</span>
            <span style={{ color: '#94a3b8', fontSize: '13px' }}>AGENT INFRASTRUCTURE</span>
            <span style={{ color: '#4a5568' }}>/</span>
            <span style={{ color: '#f0f3f8', fontSize: '13px', fontWeight: 600 }}>EXECUTION #{receipt.execution.executionId.slice(0, 8)}</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '4px', backgroundColor: isLiveDbRecord ? 'rgba(0, 229, 255, 0.1)' : 'rgba(255, 184, 0, 0.1)', color: isLiveDbRecord ? '#00e5ff' : '#ffb800', border: `1px solid ${isLiveDbRecord ? 'rgba(0, 229, 255, 0.3)' : 'rgba(255, 184, 0, 0.3)'}` }}>
              {isLiveDbRecord ? '● POSTGRES DATA PLANE' : '● SIMULATED WORKLOAD'}
            </span>
            <a
              href={`/api/agent/receipt/${receipt.execution.executionId}`}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '4px', backgroundColor: '#131720', color: '#00ff88', border: '1px solid #1a1e28', textDecoration: 'none' }}
            >
              Export Receipt JSON ↗
            </a>
          </div>
        </div>

        {/* Top Header Card: Identity & Dual-Verdict System */}
        <div style={{ backgroundColor: '#0d0f14', border: `1px solid ${verification.verified && audit.compliance === 'COMPLIANT' ? '#1a1e28' : audit.compliance === 'VIOLATION' ? 'rgba(255, 68, 68, 0.4)' : '#1a1e28'}`, borderRadius: '12px', padding: '24px', marginBottom: '24px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: '350px', height: '100%', background: isHostileSimulated ? 'radial-gradient(circle, rgba(255,184,0,0.1) 0%, transparent 70%)' : verification.verified ? 'radial-gradient(circle, rgba(0,255,136,0.06) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(255,68,68,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span style={{ color: '#00e5ff', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>
                  AUTONOMOUS AGENT IDENTITY
                </span>
                <span style={{ color: '#4a5568' }}>•</span>
                <span style={{ color: '#94a3b8', fontSize: '12px' }}>Claude 3.5 Sonnet</span>
              </div>
              <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span>Agent Execution</span>
                <code style={{ fontSize: '16px', color: '#94a3b8', backgroundColor: '#131720', padding: '3px 8px', borderRadius: '4px', border: '1px solid #1e2430' }}>
                  {receipt.execution.executionId}
                </code>
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: '#94a3b8' }}>
                <span>Public Key: <code style={{ color: '#f0f3f8' }}>{receipt.execution.agentPublicKey.slice(0, 12)}...{receipt.execution.agentPublicKey.slice(-6)}</code></span>
                <button
                  onClick={() => copyToClipboard(receipt.execution.agentPublicKey, 'key')}
                  style={{ background: 'none', border: 'none', color: '#00ff88', cursor: 'pointer', fontSize: '11px', padding: 0 }}
                >
                  {copiedText === 'key' ? '✓ Copied' : 'Copy'}
                </button>
                <span>•</span>
                <span>Started: {new Date(receipt.execution.startedAt).toUTCString()}</span>
                <span>•</span>
                <span>Protocol: <strong style={{ color: '#00ff88' }}>{receipt.version}</strong></span>
              </div>
            </div>

            {/* DUAL-VERDICT MATRIX */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {/* Verdict 1: Provenance */}
              <div style={{
                padding: '10px 16px',
                borderRadius: '8px',
                backgroundColor: verification.verified ? 'rgba(0, 255, 136, 0.08)' : 'rgba(255, 68, 68, 0.15)',
                border: `1px solid ${verification.verified ? '#00ff88' : '#ff4444'}`,
                minWidth: '180px',
              }}>
                <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>
                  1. CRYPTOGRAPHIC PROVENANCE
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: verification.verified ? '#00ff88' : '#ff4444', fontWeight: 700, fontSize: '13px' }}>
                  <span>{verification.verified ? '✓' : '✗'}</span>
                  <span>{verification.verified ? 'VALID / AUTHENTIC' : 'TAMPER DETECTED'}</span>
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                  {verification.verified ? 'Ed25519 + Chain + Solana OK' : 'Integrity check failed'}
                </div>
              </div>

              {/* Verdict 2: Policy Compliance */}
              <div style={{
                padding: '10px 16px',
                borderRadius: '8px',
                backgroundColor: audit.compliance === 'COMPLIANT' ? 'rgba(0, 229, 255, 0.08)' : audit.compliance === 'VIOLATION' ? 'rgba(255, 68, 68, 0.15)' : 'rgba(255, 184, 0, 0.15)',
                border: `1px solid ${audit.compliance === 'COMPLIANT' ? '#00e5ff' : audit.compliance === 'VIOLATION' ? '#ff4444' : '#ffb800'}`,
                minWidth: '190px',
              }}>
                <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>
                  2. BEHAVIORAL POLICY AUDIT
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: audit.compliance === 'COMPLIANT' ? '#00e5ff' : audit.compliance === 'VIOLATION' ? '#ff4444' : '#ffb800', fontWeight: 700, fontSize: '13px' }}>
                  <span>{audit.compliance === 'COMPLIANT' ? '✓' : audit.compliance === 'VIOLATION' ? '🚨' : '⚠️'}</span>
                  <span>{audit.compliance === 'COMPLIANT' ? 'COMPLIANT' : audit.compliance === 'VIOLATION' ? 'POLICY VIOLATION' : 'POLICY WARNING'}</span>
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                  Risk: <strong style={{ color: audit.overallRisk === 'CRITICAL' ? '#ff4444' : audit.overallRisk === 'HIGH' ? '#ff8800' : '#00ff88' }}>{audit.overallRisk}</strong> ({audit.riskScore}/100)
                </div>
              </div>
            </div>
          </div>

          {/* System Pipeline Bar */}
          <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #1a1e28' }}>
            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.8px' }}>
              DURABLE CONTROL/DATA PLANE PIPELINE
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <div style={{ backgroundColor: '#131720', padding: '10px 14px', borderRadius: '6px', border: '1px solid #1e2430' }}>
                <div style={{ fontSize: '11px', color: '#00ff88', fontWeight: 600 }}>✓ 1. Ingested</div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Ed25519 Validated</div>
              </div>
              <div style={{ backgroundColor: '#131720', padding: '10px 14px', borderRadius: '6px', border: '1px solid #1e2430' }}>
                <div style={{ fontSize: '11px', color: '#00ff88', fontWeight: 600 }}>✓ 2. Hash Chained</div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Monotonic Linkage</div>
              </div>
              <div style={{ backgroundColor: '#131720', padding: '10px 14px', borderRadius: '6px', border: '1px solid #1e2430' }}>
                <div style={{ fontSize: '11px', color: '#00ff88', fontWeight: 600 }}>✓ 3. Merkle Batched</div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Odd-Leaf Promoted</div>
              </div>
              <div style={{ backgroundColor: '#131720', padding: '10px 14px', borderRadius: '6px', border: '1px solid #1e2430' }}>
                <div style={{ fontSize: '11px', color: receipt.irys ? '#00ff88' : '#ffb800', fontWeight: 600 }}>
                  {receipt.irys ? '✓ 4. Archived (Irys)' : '⟳ 4. Archival Outbox'}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Permanent Arweave</div>
              </div>
              <div style={{ backgroundColor: '#131720', padding: '10px 14px', borderRadius: '6px', border: '1px solid #1e2430' }}>
                <div style={{ fontSize: '11px', color: receipt.solana ? '#00ff88' : '#ffb800', fontWeight: 600 }}>
                  {receipt.solana ? '✓ 5. Anchored (Solana)' : '⟳ 5. Solana Outbox'}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Anchor PDA Commitment</div>
              </div>
            </div>
          </div>
        </div>

        {/* INTERACTIVE ATTACK & SIMULATION COMMAND CENTER */}
        <div style={{
          backgroundColor: '#0d0f14',
          border: `1px solid ${isTampered ? '#ff4444' : isHostileSimulated ? '#ffb800' : '#1e2430'}`,
          borderRadius: '12px',
          padding: '20px 24px',
          marginBottom: '24px',
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>🔬</span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: isTampered ? '#ff4444' : isHostileSimulated ? '#ffb800' : '#00e5ff' }}>
                  {isTampered ? 'ACTIVE DATABASE TAMPER SIMULATION' : isHostileSimulated ? 'ACTIVE HOSTILE AGENT POLICY VIOLATION' : 'ZERO-TRUST ATTACK & POLICY SIMULATION SUITE'}
                </span>
              </div>
              <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#94a3b8', maxWidth: '750px' }}>
                PROVN enforces a clean separation between <strong>Provenance</strong> (<em>&quot;What happened?&quot;</em>) and <strong>Audit</strong> (<em>&quot;Was it okay?&quot;</em>). Test both failure modes below.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {/* Simulation A Button */}
              <button
                onClick={handleToggleTamper}
                disabled={isVerifying}
                style={{
                  backgroundColor: isTampered ? '#ff4444' : '#131720',
                  color: isTampered ? '#ffffff' : '#f0f3f8',
                  border: `1px solid ${isTampered ? '#ff4444' : '#2d3748'}`,
                  padding: '9px 15px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {isTampered ? '↺ Reset Tamper' : '🧪 Sim A: Database Intrusion'}
              </button>

              {/* Simulation B Button */}
              <button
                onClick={handleToggleHostile}
                disabled={isVerifying}
                style={{
                  backgroundColor: isHostileSimulated ? '#ffb800' : '#131720',
                  color: isHostileSimulated ? '#000000' : '#ffb800',
                  border: `1px solid ${isHostileSimulated ? '#ffb800' : 'rgba(255, 184, 0, 0.4)'}`,
                  padding: '9px 15px',
                  borderRadius: '6px',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {isHostileSimulated ? '↺ Reset Hostile Action' : '🚨 Sim B: Hostile Action (rm -rf /)'}
              </button>
            </div>
          </div>

          {/* Tamper Comparison Callout (Sim A) */}
          {isTampered && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,68,68,0.3)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ backgroundColor: 'rgba(255, 68, 68, 0.1)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(255,68,68,0.4)' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#ff4444', marginBottom: '4px' }}>
                  ✗ DATABASE STATE: INVALID
                </div>
                <div style={{ fontSize: '11px', color: '#f87171' }}>
                  Event #03 has been modified in local PostgreSQL (<code>commit = &apos;fake999_malicious_override&apos;</code>).
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
                  Computed Leaf: <code style={{ color: '#ff8888' }}>{verification.failures[0]?.computed?.slice(0, 18) || 'broken_hash'}...</code>
                </div>
              </div>

              <div style={{ backgroundColor: 'rgba(0, 255, 136, 0.05)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(0,255,136,0.3)' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#00ff88', marginBottom: '4px' }}>
                  ✓ PUBLIC COMMITMENT: VALID
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                  Solana PDA holds immutable Merkle root committed on-chain.
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
                  Solana Anchor Root: <code style={{ color: '#00ff88' }}>{receipt.merkle.root.slice(0, 18)}...</code>
                </div>
              </div>

              <div style={{ gridColumn: 'span 2', textAlign: 'center', color: '#ff4444', fontWeight: 700, fontSize: '13px', padding: '6px', letterSpacing: '0.5px' }}>
                🚨 DATABASE ≠ COMMITTED PROVENANCE — The local record does not match the immutable provenance.
              </div>
            </div>
          )}

          {/* Hostile Action Thesis Callout (Sim B) */}
          {isHostileSimulated && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,184,0,0.3)' }}>
              <div style={{ backgroundColor: 'rgba(255, 184, 0, 0.08)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255, 184, 0, 0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '18px' }}>⚖️</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffb800' }}>
                    THE CORE PROVN THESIS: PROVENANCE VALID ≠ ACTION SAFE OR AUTHORIZED
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '10px' }}>
                  <div style={{ backgroundColor: '#131720', padding: '12px', borderRadius: '6px', border: '1px solid #1e2430' }}>
                    <div style={{ fontSize: '11px', color: '#00ff88', fontWeight: 700 }}>
                      ✓ CRYPTOGRAPHIC PROVENANCE: 100% VALID
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                      The agent&apos;s Ed25519 key genuinely signed <code>rm -rf /</code>, the hash chain is intact, and the batch is committed to Solana.
                    </div>
                  </div>
                  <div style={{ backgroundColor: '#131720', padding: '12px', borderRadius: '6px', border: '1px solid #1e2430' }}>
                    <div style={{ fontSize: '11px', color: '#ff4444', fontWeight: 700 }}>
                      🚨 POLICY ENGINE: CRITICAL VIOLATION (Risk 95/100)
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                      Deterministic rules flagged destructive shell command and unauthorized credential exfiltration (<code>.env.production</code>).
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: '#f0f3f8', marginTop: '12px', fontWeight: 600 }}>
                  💡 <em>&quot;PROVN does not say this action was good. PROVN proves that this hostile action was authentically committed by this agent and can never be repudiated.&quot;</em>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* TAB NAVIGATION: Provenance vs Policy Audit */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid #1a1e28', paddingBottom: '8px' }}>
          <button
            onClick={() => setActiveTab('PROVENANCE')}
            style={{
              backgroundColor: activeTab === 'PROVENANCE' ? '#131720' : 'transparent',
              color: activeTab === 'PROVENANCE' ? '#00ff88' : '#94a3b8',
              border: `1px solid ${activeTab === 'PROVENANCE' ? '#00ff88' : 'transparent'}`,
              padding: '8px 18px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            🛡️ CRYPTOGRAPHIC PROVENANCE & TIMELINE
          </button>
          <button
            onClick={() => setActiveTab('AUDIT')}
            style={{
              backgroundColor: activeTab === 'AUDIT' ? '#131720' : 'transparent',
              color: activeTab === 'AUDIT' ? (audit.compliance === 'VIOLATION' ? '#ff4444' : '#00e5ff') : '#94a3b8',
              border: `1px solid ${activeTab === 'AUDIT' ? (audit.compliance === 'VIOLATION' ? '#ff4444' : '#00e5ff') : 'transparent'}`,
              padding: '8px 18px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>⚖️ DETERMINISTIC POLICY & AUDIT</span>
            {audit.findings.length > 0 && (
              <span style={{ backgroundColor: '#ff4444', color: '#ffffff', fontSize: '10px', padding: '1px 6px', borderRadius: '10px' }}>
                {audit.findings.length}
              </span>
            )}
          </button>
        </div>

        {/* TAB CONTENT: PROVENANCE */}
        {activeTab === 'PROVENANCE' && (
          <>
            {/* 5-Link Provenance Checklist */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '24px' }}>
              <div style={{ backgroundColor: '#0d0f14', padding: '16px', borderRadius: '8px', border: `1px solid ${verification.layers.agentSignature === 'VALID' ? '#1a1e28' : '#ff4444'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>1. AGENT SIGNATURES</span>
                  <span style={{ color: verification.layers.agentSignature === 'VALID' ? '#00ff88' : '#ff4444', fontWeight: 700 }}>
                    {verification.layers.agentSignature === 'VALID' ? '✓ VALID' : '✗ INVALID'}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Ed25519 detached per event</div>
              </div>

              <div style={{ backgroundColor: '#0d0f14', padding: '16px', borderRadius: '8px', border: `1px solid ${verification.layers.hashChain === 'VALID' ? '#1a1e28' : '#ff4444'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>2. HASH CHAIN</span>
                  <span style={{ color: verification.layers.hashChain === 'VALID' ? '#00ff88' : '#ff4444', fontWeight: 700 }}>
                    {verification.layers.hashChain === 'VALID' ? '✓ VALID' : '✗ INVALID'}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Monotonic sequential links</div>
              </div>

              <div style={{ backgroundColor: '#0d0f14', padding: '16px', borderRadius: '8px', border: `1px solid ${verification.layers.merkleInclusion === 'VALID' ? '#1a1e28' : '#ff4444'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>3. MERKLE INCLUSION</span>
                  <span style={{ color: verification.layers.merkleInclusion === 'VALID' ? '#00ff88' : '#ff4444', fontWeight: 700 }}>
                    {verification.layers.merkleInclusion === 'VALID' ? '✓ VALID' : '✗ INVALID'}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Log2(N) proof paths intact</div>
              </div>

              <div style={{ backgroundColor: '#0d0f14', padding: '16px', borderRadius: '8px', border: '1px solid #1a1e28' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>4. SOLANA ANCHOR</span>
                  <span style={{ color: '#00ff88', fontWeight: 700 }}>
                    {receipt.solana ? '✓ COMMITTED' : '○ PENDING'}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>On-chain batch PDA</div>
              </div>

              <div style={{ backgroundColor: '#0d0f14', padding: '16px', borderRadius: '8px', border: '1px solid #1a1e28' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>5. IRYS ARCHIVAL</span>
                  <span style={{ color: '#00ff88', fontWeight: 700 }}>
                    {receipt.irys ? '✓ AVAILABLE' : '○ PENDING'}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Arweave payload envelope</div>
              </div>
            </div>

            {/* Anchors & Batches Details */}
            <div style={{ backgroundColor: '#0d0f14', border: '1px solid #1a1e28', borderRadius: '12px', padding: '20px 24px', marginBottom: '24px' }}>
              <div style={{ fontSize: '12px', color: '#00e5ff', textTransform: 'uppercase', fontWeight: 700, marginBottom: '14px' }}>
                BATCH ANCHORS & COMMITMENTS
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>MERKLE ROOT</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <code style={{ fontSize: '12px', color: '#f0f3f8', backgroundColor: '#131720', padding: '4px 8px', borderRadius: '4px' }}>
                      {receipt.merkle.root.slice(0, 24)}...{receipt.merkle.root.slice(-8)}
                    </code>
                    <button
                      onClick={() => copyToClipboard(receipt.merkle.root, 'merkle')}
                      style={{ background: 'none', border: 'none', color: '#00ff88', cursor: 'pointer', fontSize: '11px' }}
                    >
                      {copiedText === 'merkle' ? '✓' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>SOLANA DEVNET COMMITMENT</div>
                  <div style={{ marginTop: '4px' }}>
                    {receipt.solana?.signature ? (
                      <a
                        href={`https://explorer.solana.com/tx/${receipt.solana.signature}?cluster=devnet`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: '12px', color: '#00ff88', textDecoration: 'none' }}
                      >
                        TX: {receipt.solana.signature.slice(0, 16)}... ↗
                      </a>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>PDA: {receipt.solana?.pda.slice(0, 16)}...</span>
                    )}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>IRYS ARWEAVE ARCHIVE</div>
                  <div style={{ marginTop: '4px' }}>
                    {receipt.irys?.txId ? (
                      <a
                        href={`https://devnet.irys.xyz/${receipt.irys.txId}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: '12px', color: '#00e5ff', textDecoration: 'none' }}
                      >
                        TX: {receipt.irys.txId.slice(0, 16)}... ↗
                      </a>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#64748b' }}>Evidence envelope pending upload</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Event Stream & Inspector Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '24px' }}>

              {/* Left Column: Event Stream */}
              <div style={{ backgroundColor: '#0d0f14', border: '1px solid #1a1e28', borderRadius: '12px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <span style={{ fontSize: '12px', color: '#00e5ff', textTransform: 'uppercase', fontWeight: 700 }}>
                    EVENT STREAM ({receipt.events.length})
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Click row to inspect</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {receipt.events.map((ev, idx) => {
                    const isSelected = selectedEventIndex === idx
                    const isTamperedEvent = isTampered && (ev.sequence === 3 || ev.eventType === 'git.operation')
                    const isHostileEvent = isHostileSimulated && (String(ev.payload?.command || '').includes('rm -rf') || String(ev.payload?.path || '').includes('.env') || String(ev.payload?.tool || '').includes('prod.database'))

                    return (
                      <div
                        key={ev.eventId}
                        onClick={() => setSelectedEventIndex(idx)}
                        style={{
                          padding: '10px 14px',
                          borderRadius: '6px',
                          backgroundColor: isSelected ? '#1e2430' : '#131720',
                          border: `1px solid ${isTamperedEvent ? '#ff4444' : isHostileEvent ? '#ffb800' : isSelected ? '#00ff88' : '#1e2430'}`,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '11px', color: '#64748b', width: '22px' }}>
                            {String(ev.sequence).padStart(2, '0')}
                          </span>
                          <span style={{
                            fontSize: '11px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: ev.eventType.startsWith('git') ? 'rgba(0, 229, 255, 0.1)' : ev.eventType.startsWith('tool') ? 'rgba(255, 184, 0, 0.1)' : 'rgba(0, 255, 136, 0.1)',
                            color: ev.eventType.startsWith('git') ? '#00e5ff' : ev.eventType.startsWith('tool') ? '#ffb800' : '#00ff88',
                            fontWeight: 600,
                          }}>
                            {ev.eventType}
                          </span>
                          <span style={{ fontSize: '12px', color: isTamperedEvent ? '#ff8888' : isHostileEvent ? '#ffb800' : '#cbd5e1' }}>
                            {String(ev.payload?.path || ev.payload?.tool || ev.payload?.command || ev.payload?.commitHash || ev.payload?.summary || ev.payload?.operation || 'action')}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '11px', color: isTamperedEvent ? '#ff4444' : isHostileEvent ? '#ffb800' : '#00ff88' }}>
                            {isTamperedEvent ? '✗ TAMPERED' : isHostileEvent ? '⚠️ HOSTILE' : '✓'}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Right Column: Event Cryptographic Inspector */}
              <div style={{ backgroundColor: '#0d0f14', border: '1px solid #1a1e28', borderRadius: '12px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <span style={{ fontSize: '12px', color: '#00e5ff', textTransform: 'uppercase', fontWeight: 700 }}>
                    CRYPTOGRAPHIC INSPECTOR // EVENT #{String(selectedEvent.sequence).padStart(2, '0')}
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    Ed25519 & SHA-256
                  </span>
                </div>

                {/* Field: Canonical Format */}
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>CANONICAL FORMAT (DETERMINISTIC LINE-ORIENTED)</div>
                  <pre style={{ margin: 0, backgroundColor: '#131720', padding: '10px', borderRadius: '6px', fontSize: '11px', color: '#94a3b8', whiteSpace: 'pre-wrap', border: '1px solid #1e2430' }}>
{`PROVN-AGENT-EVENT-V1
execution:${selectedEvent.executionId}
sequence:${selectedEvent.sequence}
agent:${selectedEvent.agentPublicKey}
event_type:${selectedEvent.eventType}
timestamp:${selectedEvent.timestamp}
parent_event:${selectedEvent.parentEventId || 'none'}
previous_event_hash:${selectedEvent.previousEventHash || 'none'}
payload_hash:${selectedEvent.payloadHash}`}
                  </pre>
                </div>

                {/* Field: Event Hash & Signature */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px', marginBottom: '14px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>EVENT HASH (SHA-256)</div>
                    <code style={{ fontSize: '11px', color: '#00ff88', wordBreak: 'break-all' }}>
                      {selectedEvent.eventHash}
                    </code>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>PREVIOUS EVENT HASH</div>
                    <code style={{ fontSize: '11px', color: selectedEvent.previousEventHash ? '#94a3b8' : '#64748b', wordBreak: 'break-all' }}>
                      {selectedEvent.previousEventHash || '0000000000000000000000000000000000000000000000000000000000000000 (GENESIS)'}
                    </code>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>ED25519 DETACHED SIGNATURE</div>
                    <code style={{ fontSize: '11px', color: '#00e5ff', wordBreak: 'break-all' }}>
                      {selectedEvent.signature}
                    </code>
                  </div>
                </div>

                {/* Field: Raw Payload Commitment */}
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>PAYLOAD COMMITMENT DATA</div>
                  <pre style={{ margin: 0, backgroundColor: '#131720', padding: '10px', borderRadius: '6px', fontSize: '11px', color: '#f0f3f8', maxHeight: '120px', overflowY: 'auto', border: '1px solid #1e2430' }}>
                    {JSON.stringify(selectedEvent.payload, null, 2)}
                  </pre>
                </div>

                {/* Field: Merkle Proof Inclusion Path */}
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>MERKLE PROOF INCLUSION PATH</div>
                  <div style={{ backgroundColor: '#131720', padding: '10px', borderRadius: '6px', border: '1px solid #1e2430' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#00ff88' }}>
                      <span>Leaf Hash:</span>
                      <code style={{ color: '#94a3b8' }}>{selectedEvent.eventHash.slice(0, 14)}...</code>
                      <span>──► Root:</span>
                      <code style={{ color: '#00ff88' }}>{receipt.merkle.root.slice(0, 14)}...</code>
                    </div>
                    <div style={{ fontSize: '10px', color: '#64748b', marginTop: '6px' }}>
                      Cryptographic inclusion verified using deterministic odd-leaf promotion algorithm.
                    </div>
                  </div>
                </div>

              </div>

            </div>
          </>
        )}

        {/* TAB CONTENT: AUDIT & POLICY FINDINGS */}
        {activeTab === 'AUDIT' && (
          <div>
            {/* Policy Selector & Risk Summary Bar */}
            <div style={{ backgroundColor: '#0d0f14', border: '1px solid #1a1e28', borderRadius: '12px', padding: '20px 24px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                    ACTIVE EXECUTION POLICY
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#f0f3f8', marginTop: '2px' }}>
                    {activePolicy.policyName}
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                    {activePolicy.description}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {Object.keys(STANDARD_POLICY_PRESETS).map((key) => {
                    const isSelected = selectedPolicyKey === key
                    return (
                      <button
                        key={key}
                        onClick={() => setSelectedPolicyKey(key)}
                        style={{
                          backgroundColor: isSelected ? '#00e5ff' : '#131720',
                          color: isSelected ? '#000000' : '#94a3b8',
                          border: `1px solid ${isSelected ? '#00e5ff' : '#1e2430'}`,
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {key.replace(/_/g, ' ')}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Metrics Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div style={{ backgroundColor: '#131720', padding: '14px', borderRadius: '8px', border: '1px solid #1e2430' }}>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>COMPLIANCE VERDICT</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: audit.compliance === 'COMPLIANT' ? '#00ff88' : '#ff4444', marginTop: '4px' }}>
                    {audit.compliance === 'COMPLIANT' ? '✓ COMPLIANT' : '🚨 POLICY VIOLATION'}
                  </div>
                </div>

                <div style={{ backgroundColor: '#131720', padding: '14px', borderRadius: '8px', border: '1px solid #1e2430' }}>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>BEHAVIORAL RISK SCORE</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: audit.overallRisk === 'CRITICAL' ? '#ff4444' : audit.overallRisk === 'HIGH' ? '#ff8800' : '#00ff88', marginTop: '4px' }}>
                    {audit.riskScore}/100 ({audit.overallRisk})
                  </div>
                </div>

                <div style={{ backgroundColor: '#131720', padding: '14px', borderRadius: '8px', border: '1px solid #1e2430' }}>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>VIOLATIONS DETECTED</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: audit.summary.violationsCount > 0 ? '#ff4444' : '#00ff88', marginTop: '4px' }}>
                    {audit.summary.violationsCount} Violations ({audit.summary.warningsCount} Warnings)
                  </div>
                </div>

                <div style={{ backgroundColor: '#131720', padding: '14px', borderRadius: '8px', border: '1px solid #1e2430' }}>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>ACTIONS EVALUATED</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#f0f3f8', marginTop: '4px' }}>
                    {audit.summary.totalEventsEvaluated} Sequential Actions
                  </div>
                </div>
              </div>
            </div>

            {/* Findings List */}
            <div style={{ backgroundColor: '#0d0f14', border: '1px solid #1a1e28', borderRadius: '12px', padding: '20px 24px', marginBottom: '24px' }}>
              <div style={{ fontSize: '12px', color: '#00e5ff', textTransform: 'uppercase', fontWeight: 700, marginBottom: '16px' }}>
                DETAILED AUDIT FINDINGS ({audit.findings.length})
              </div>

              {audit.findings.length === 0 ? (
                <div style={{ backgroundColor: 'rgba(0, 255, 136, 0.05)', padding: '24px', borderRadius: '8px', border: '1px solid rgba(0, 255, 136, 0.2)', textAlign: 'center' }}>
                  <div style={{ fontSize: '18px', marginBottom: '6px' }}>✓</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#00ff88' }}>
                    ZERO POLICY VIOLATIONS DETECTED
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                    All actions committed in this execution strictly adhere to {activePolicy.policyName}.
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {audit.findings.map((fnd) => (
                    <div
                      key={fnd.id}
                      style={{
                        backgroundColor: '#131720',
                        border: `1px solid ${fnd.severity === 'CRITICAL' ? 'rgba(255,68,68,0.5)' : 'rgba(255,184,0,0.5)'}`,
                        borderRadius: '8px',
                        padding: '16px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '8px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{
                              fontSize: '10px',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              backgroundColor: fnd.severity === 'CRITICAL' ? 'rgba(255, 68, 68, 0.2)' : 'rgba(255, 184, 0, 0.2)',
                              color: fnd.severity === 'CRITICAL' ? '#ff4444' : '#ffb800',
                              fontWeight: 700,
                            }}>
                              {fnd.severity}
                            </span>
                            <span style={{ fontSize: '11px', color: '#64748b' }}>{fnd.ruleId}</span>
                            <span style={{ fontSize: '11px', color: '#4a5568' }}>•</span>
                            <span style={{ fontSize: '11px', color: '#00e5ff' }}>Event #{String(fnd.eventSequence).padStart(2, '0')}</span>
                          </div>
                          <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#f0f3f8', margin: 0 }}>
                            {fnd.title}
                          </h3>
                        </div>

                        <button
                          onClick={() => {
                            setSelectedEventIndex(fnd.eventSequence)
                            setActiveTab('PROVENANCE')
                          }}
                          style={{
                            backgroundColor: '#1e2430',
                            color: '#00ff88',
                            border: '1px solid #2d3748',
                            borderRadius: '4px',
                            padding: '4px 10px',
                            fontSize: '11px',
                            cursor: 'pointer',
                          }}
                        >
                          Inspect Event ↗
                        </button>
                      </div>

                      <p style={{ margin: '6px 0 10px 0', fontSize: '12px', color: '#cbd5e1' }}>
                        {fnd.message}
                      </p>

                      {fnd.matchedPattern && (
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px' }}>
                          Matched Prohibited Pattern: <code style={{ color: '#ffb800', backgroundColor: '#0d0f14', padding: '2px 6px', borderRadius: '4px' }}>{fnd.matchedPattern}</code>
                        </div>
                      )}

                      {fnd.remediation && (
                        <div style={{ backgroundColor: 'rgba(0, 229, 255, 0.05)', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(0, 229, 255, 0.15)', fontSize: '11px', color: '#94a3b8' }}>
                          <strong style={{ color: '#00e5ff' }}>Remediation:</strong> {fnd.remediation}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Active Policy Rules Breakdown */}
            <div style={{ backgroundColor: '#0d0f14', border: '1px solid #1a1e28', borderRadius: '12px', padding: '20px 24px' }}>
              <div style={{ fontSize: '12px', color: '#00e5ff', textTransform: 'uppercase', fontWeight: 700, marginBottom: '14px' }}>
                ACTIVE POLICY GUARDRAILS SPECIFICATION
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                <div style={{ backgroundColor: '#131720', padding: '14px', borderRadius: '8px', border: '1px solid #1e2430' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>PERMITTED ACTION TYPES</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {(activePolicy.allowedEventTypes || []).map((t) => (
                      <span key={t} style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#0d0f14', color: '#00ff88', border: '1px solid #1e2430' }}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ backgroundColor: '#131720', padding: '14px', borderRadius: '8px', border: '1px solid #1e2430' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>FORBIDDEN FILE PATTERNS</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {(activePolicy.forbiddenFilePatterns || []).map((p) => (
                      <span key={p} style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#0d0f14', color: '#ff4444', border: '1px solid #1e2430' }}>
                        {p}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ backgroundColor: '#131720', padding: '14px', borderRadius: '8px', border: '1px solid #1e2430' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>PROHIBITED COMMANDS</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {(activePolicy.forbiddenCommands || []).map((c) => (
                      <span key={c} style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#0d0f14', color: '#ffb800', border: '1px solid #1e2430' }}>
                        {c}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ backgroundColor: '#131720', padding: '14px', borderRadius: '8px', border: '1px solid #1e2430' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>PROTECTED TOOL NAMESPACES</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {(activePolicy.forbiddenTools || []).map((t) => (
                      <span key={t} style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#0d0f14', color: '#ff4444', border: '1px solid #1e2430' }}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
