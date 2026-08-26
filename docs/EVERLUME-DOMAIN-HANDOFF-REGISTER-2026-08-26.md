# Everlume Domain Handoff Register — August 26, 2026

## Intended ownership

- Business: Everlume
- Co-owner: Denisha Phillips — 50%
- Co-owner: Veronicah Williams — 50%
- Company service account: `everlume.admin@gmail.com`
- Xenth role after handoff: account manager and technical support coordinator, not domain owner

## Current public record

- Domain: `myeverlume.com`
- Registrar: Cloudflare Registrar
- Authoritative nameservers: `nick.ns.cloudflare.com` and `uma.ns.cloudflare.com`
- Recorded expiration: July 22, 2027

## Custody status

The accessible Xenth Cloudflare account previously inspected does not contain `myeverlume.com`. The Cloudflare account that currently controls the authoritative zone and registrar therefore remains unverified. No DNS, registrar, nameserver, or production-domain change is authorized until that account is located or recovered.

## Safe handoff sequence

1. Create or confirm an Everlume-controlled Cloudflare account using the company service identity.
2. Locate or recover the source Cloudflare account containing `myeverlume.com`.
3. Record the source account owner, recovery method, MFA status, registrar lock, renewal status, and current billing responsibility without exposing secrets.
4. Export the complete live DNS zone and independently record every website, email, verification, and service record.
5. Add the domain to the Everlume destination account and recreate/verify the DNS configuration before any move.
6. Disable DNSSEC only when Cloudflare’s documented transfer flow requires it and a rollback owner is present.
7. Complete the Cloudflare inter-account move with confirmation from both the source and destination accounts.
8. Verify website, email, SSL, redirects, Netlify routing, and recovery access immediately after the move.
9. Confirm Everlume controls renewal and recovery; remove Xenth’s ownership/billing authority while retaining only the support access explicitly approved by both owners.

## Release boundary

This register prepares custody transfer only. It does not authorize production commerce, product publication, inventory changes, postage purchases, legal approval, or a production release.
