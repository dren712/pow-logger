use anchor_lang::prelude::*;

declare_id!("FZomvFyB1R2CQZwoTKhU8f2i1hVd1NS3TYUaFrwijmZx");

#[program]
pub mod provn_anchor {
    use super::*;

    /// Anchors an immutable cryptographic proof commitment on Solana.
    pub fn anchor_proof(
        ctx: Context<AnchorProof>,
        proof_id: u64,
        payload_hash: [u8; 32],
        timestamp: i64,
        protocol_version: u8,
        archive_tx_id: Option<String>,
    ) -> Result<()> {
        let proof_anchor = &mut ctx.accounts.proof_anchor;
        proof_anchor.proof_id = proof_id;
        proof_anchor.authority = ctx.accounts.authority.key();
        proof_anchor.payload_hash = payload_hash;
        proof_anchor.timestamp = timestamp;
        proof_anchor.protocol_version = protocol_version;
        proof_anchor.bump = ctx.bumps.proof_anchor;

        let mut tx_bytes = [0u8; 43];
        if let Some(ref tx_id) = archive_tx_id {
            let bytes = tx_id.as_bytes();
            let len = bytes.len().min(43);
            tx_bytes[..len].copy_from_slice(&bytes[..len]);
        }
        proof_anchor.archive_tx_id = tx_bytes;

        emit!(ProofAnchoredEvent {
            proof_id,
            authority: ctx.accounts.authority.key(),
            payload_hash,
            timestamp,
            protocol_version,
        });

        Ok(())
    }

    /// Updates the decentralized Arweave / Irys transaction ID after archival confirmation.
    pub fn update_archive_tx(
        ctx: Context<UpdateArchiveTx>,
        proof_id: u64,
        archive_tx_id: String,
    ) -> Result<()> {
        let proof_anchor = &mut ctx.accounts.proof_anchor;
        require!(
            proof_anchor.authority == ctx.accounts.authority.key(),
            ProvnError::Unauthorized
        );

        let mut tx_bytes = [0u8; 43];
        let bytes = archive_tx_id.as_bytes();
        let len = bytes.len().min(43);
        tx_bytes[..len].copy_from_slice(&bytes[..len]);
        proof_anchor.archive_tx_id = tx_bytes;

        emit!(ArchiveConfirmedEvent {
            proof_id,
            archive_tx_id,
        });

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(proof_id: u64)]
pub struct AnchorProof<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + ProofAnchor::INIT_SPACE,
        seeds = [b"proof", authority.key().as_ref(), proof_id.to_le_bytes().as_ref()],
        bump
    )]
    pub proof_anchor: Account<'info, ProofAnchor>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(proof_id: u64)]
pub struct UpdateArchiveTx<'info> {
    #[account(
        mut,
        seeds = [b"proof", authority.key().as_ref(), proof_id.to_le_bytes().as_ref()],
        bump = proof_anchor.bump,
        has_one = authority,
    )]
    pub proof_anchor: Account<'info, ProofAnchor>,

    pub authority: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct ProofAnchor {
    pub proof_id: u64,
    pub authority: Pubkey,
    pub payload_hash: [u8; 32],
    pub timestamp: i64,
    pub protocol_version: u8,
    pub archive_tx_id: [u8; 43],
    pub bump: u8,
}

#[event]
pub struct ProofAnchoredEvent {
    pub proof_id: u64,
    pub authority: Pubkey,
    pub payload_hash: [u8; 32],
    pub timestamp: i64,
    pub protocol_version: u8,
}

#[event]
pub struct ArchiveConfirmedEvent {
    pub proof_id: u64,
    pub archive_tx_id: String,
}

#[error_code]
pub enum ProvnError {
    #[msg("You are not authorized to update this proof anchor.")]
    Unauthorized,
    #[msg("Invalid payload hash supplied.")]
    InvalidPayloadHash,
}
