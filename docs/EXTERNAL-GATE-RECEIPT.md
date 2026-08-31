# Everlume — External Gate Closure Receipt

**Deployed review head:** `dfcf8e3991fc1e769a75a109024e0f5e9fe971b4`
**Immediate parent:** `087a56e3a00a9282811afbff181de18d75970397`
**Underlying technical payload:** `494835ad6ab24fb9107a8117426439d179be45e7`
**Review:** GitHub PR #5 — open and unmerged
**Preview:** Netlify `6a88ff89843d050007f2e35e`
**Production ruling:** NO-GO
**Commerce:** disabled

This receipt is completed only with direct evidence. A blank signature, missing device, inaccessible account, or untested recovery path is not a pass.

## 1. Administrative custody

For each system, record the signed-in identity, effective role, billing owner, recovery method, second administrator, and successful access date. Resolve the conflict among `everlume.admin@gmail.com`, `admin.everlume@gmail.com`, and `admin@myeverlume.com`; do not infer that any address is canonical.

| System | Signed-in identity | Effective role | Billing owner | Recovery verified | Second admin | Evidence link/date | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GitHub | `XENTHGRP` observed | repository WRITE; owner/admin is `everlumepep` | unverified | no | unverified | 2026-08-21 | PARTIAL |
| Netlify | `everlume.admin@gmail.com` / DENISHA P observed | sole Owner; deploy and rollback history accessible | unverified | account 2FA enabled; independent recovery owner absent | no | 2026-08-21 | PARTIAL |
| Supabase | `admin@xenthgroup.com` observed | sole organization Owner for project `zyerhqcqxcjdnfmdbutg` | unverified | MFA enabled; only one authenticator and no independent recovery owner | no | 2026-08-21 | PARTIAL |
| Cloudflare/registrar | `admin@xenthgroup.com` observed in account `3fcf08fd6b674eb3b230b819731c502a` | authenticated switcher exposes exactly one account; its domain inventory contains zero domains or subdomains | unverified | no | no | public registry identifies Cloudflare, Inc. registrar IANA 1910 and `nick`/`uma` Cloudflare nameservers, but the authenticated account does not contain `myeverlume.com`; controlling account remains inaccessible; 2026-08-22 | FAIL |
| Production email | `admin@xenthgroup.com` observed under Michael Derby | primary mailbox control | XENTH | independent recovery unverified | no | controlled Supabase recovery mail received 2026-08-21 | PARTIAL |
| Monitoring | Michael Derby / `admin@xenthgroup.com` assigned temporary primary | GitHub/Netlify deploy checks visible; one controlled email delivery exercised; preview/PR identity heartbeat active | unverified | no independent escalation owner | no | `Everlume Preview Watch` checks preview availability, PR state/head and deploy identity every 30 minutes; Auth/database/form coverage and independent escalation remain open; 2026-08-21 | PARTIAL |

## 2. Human browser, device, and accessibility matrix

Use the exact preview. Record tester, date/time, OS/browser/device versions, viewport, and screenshots. Verify entrance, catalog, product detail, inquiry validation without submission, sign-in, recovery request to an approved test inbox, account portal, customer COMMAND refusal, administrator COMMAND access, console errors, broken media, reduced motion, zoom, and failure states.

| Surface | Tester and environment | Evidence | Result |
| --- | --- | --- | --- |
| Safari desktop | Exact deploy `6a88ff89…` rendered with the client-approved logo; semantic tree exposed navigation, headings, real form controls and footer. Native hidden-state correction removed the Netlify honeypot from Safari's accessibility tree while preserving the real name field and submit control | macOS 26.3.1 Safari; 2026-08-21 | PASS FOR AUTOMATED/DESKTOP SCOPE |
| Firefox desktop | Exact preview entrance rendered at 1440×1000 with black star field, confirmation panel and locked logo intact | Firefox headless using isolated profile; 2026-08-21 | PASS FOR VISUAL ENTRANCE SCOPE |
| Real iPhone |  |  | HOLD |
| Physical tablet |  |  | HOLD |
| Keyboard-only | Safari traversal exposed a visually hidden Netlify honeypot in the earlier candidate. Exact head `dfcf8e3…` removes it from keyboard and Safari accessibility navigation; deployed regression and live Safari AX checks pass. Complete Founder-observed journey and focus-visibility narrative remain outstanding | 2026-08-21 | PARTIAL |
| VoiceOver/NVDA |  |  | HOLD |
| Reduced motion / 200% zoom | Candidate reflowed in Safari at 200% with responsive navigation and locked logo intact. macOS Reduce Motion was enabled at OS level, the exact preview remained intact and usable after reload, and the original OS setting was restored | 2026-08-21 | PASS FOR DESKTOP SCOPE |

## 3. Recovery and operations

| Gate | Required evidence | Owner | Evidence/date | Result |
| --- | --- | --- | --- | --- |
| Account recovery | Approved test inbox receives message; link returns only to approved preview; session completes safely | Michael Derby | exactly one message received at `admin@xenthgroup.com`; SPF/DKIM/DMARC pass; preview reset completed; fresh customer-only session verified; 2026-08-21 | PASS |
| Inquiry delivery | Marked test reaches approved internal recipient; no real customer contacted |  |  | HOLD |
| Backup export | Timestamped export, checksum, encrypted storage location, retention owner | Michael Derby, temporary primary | owner-only FileVault-protected archive `everlume-full-verified.pgdump`; SHA-256 `0ab7644a42a82c728bb5ccd592dace4eb415bb11a7dad5dbbf6c5b74d18b8044`; 2026-08-21 | PASS |
| Isolated restore | Restore into isolated non-production target; migration count, row counts, RLS, Auth and smoke checks | Michael Derby, temporary primary | isolated PostgreSQL 17 Unix-socket-only restore; 13 migrations, 18/18 RLS tables, 35 policies, 5 Auth users and all live row counts matched; service stopped after verification; 2026-08-21 | PASS |
| Monitoring | Synthetic preview check and deploy/form/Auth/database alerts reach named escalation owner | Michael Derby, temporary primary | `Everlume Preview Watch` runs every 30 minutes against exact preview, PR head/state and deploy identity; controlled email channel and deploy checks passed. Auth, database and form coverage plus independent escalation remain open | PARTIAL |
| Incident response | Named primary/secondary, acknowledgement target, rollback authority and test receipt | Michael Derby is temporary primary | no independent acknowledgement/escalation owner; rollback identities preserved; 2026-08-21 | HOLD |

Local schema reconstruction passes all 13 migrations and 43/43 invariants. A real non-production export and isolated restore now also pass; retention custody and an independent recovery owner remain open.

## 4. Legal and Founder decision

| Approval | Named approver | Exact document/candidate | Date | Evidence | Result |
| --- | --- | --- | --- | --- | --- |
| Terms |  | Terms v1.0 replacement |  |  | HOLD |
| Privacy |  | Privacy notice for enabled account/Auth behavior |  |  | HOLD |
| Research-use language |  | Exact preview |  |  | HOLD |
| Operations/recovery |  | Exact runbooks and receipts |  |  | HOLD |
| Founder |  | Review head `dfcf8e3…`; immediate parent `087a56e…`; logo candidate ancestor `7b6b8e66…`; underlying technical payload `494835ad…`; deploy `6a88ff89…` |  |  | HOLD |

## 5. Rollback identities

- Immediate review rollback: `087a56e3a00a9282811afbff181de18d75970397`; deploy `6a88ff456d359a00087b46de`
- Logo candidate rollback: `7b6b8e66a054477340fe7614d781432d9ed87e79`; deploy `6a88f8989229080008f456fb`
- Prior documentation review rollback: `f321174a4a7fc940dc686039e6b0eb3332918baf`; deploy `6a87834e2df9c200073681d9`
- Prior technical review rollback: `494835ad6ab24fb9107a8117426439d179be45e7`; deploy `6a87431c8d0cee0008ef716c`
- Earlier connected preview: commit `801b95633bfd26d0f0cd912f2d49b5bd3c2b17a1`; deploy `6a873a67c7878a5bdba432ff`
- Current production observed: Git merge `780249bf46e0b1e7ddd43ce26899833141f99f28`; deploy `6a871f9299c9d8000863e666`
- Preserved prior production rollback: commit `65a2ac8f61d3595e5258cd3c5a747be4d651307e`; deploy `6a8682629962070009eaf22c`

No rollback, merge, production promotion, DNS change, commerce activation, customer submission, deletion, or archival action is authorized by this receipt.

## Final decision

**NO-GO until every HOLD above has direct evidence and the Founder approves the exact deployed review head, its technical payload parent, and its deployment identity.**
