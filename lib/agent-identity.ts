// This module previously implemented a custom JWE-based identity token scheme
// (RSA-OAEP-256 + AES-256-GCM, x-agent-identity-token header). It has been
// replaced by the AAP-spec Identity-Presentation flow:
//
//   - Service issues a urn:aap:claims-required challenge (lib/challenge-nonce.ts)
//   - Agent presents a verified SD-JWT-VC or aap-claims+jwt (lib/sd-jwt-verify.ts)
//
// See docs/decisions.md §2026-06-17 for the rationale.
// The file is kept as a tombstone so git history retains the context.
