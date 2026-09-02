# Everlume — External Gate Closure Receipt

**Candidate:** `494835ad6ab24fb9107a8117426439d179be45e7`
**Review:** GitHub PR #5 — open and unmerged
**Preview:** Netlify `6a87431c8d0cee0008ef716c`
**Production ruling:** NO-GO
**Commerce:** disabled

This receipt is completed only with direct evidence. A blank signature, missing device, inaccessible account, or untested recovery path is not a pass.

## 1. Administrative custody

For each system, record the signed-in identity, effective role, billing owner, recovery method, second administrator, and successful access date. Resolve the conflict among `everlume.admin@gmail.com`, `admin.everlume@gmail.com`, and `admin@myeverlume.com`; do not infer that any address is canonical.

| System | Signed-in identity | Effective role | Billing owner | Recovery verified | Second admin | Evidence link/date | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GitHub |  |  |  |  |  |  | HOLD |
| Netlify | `everlume.admin@gmail.com` observed | sole Owner observed |  | no | no | 2026-08-20 | HOLD |
| Supabase |  |  |  |  |  |  | HOLD |
| Cloudflare/registrar |  |  |  |  |  |  | HOLD |
| Production email |  |  |  |  |  |  | HOLD |
| Monitoring |  |  |  |  |  |  | HOLD |

## 2. Human browser, device, and accessibility matrix

Use the exact preview. Record tester, date/time, OS/browser/device versions, viewport, and screenshots. Verify entrance, catalog, product detail, inquiry validation without submission, sign-in, recovery request to an approved test inbox, account portal, customer COMMAND refusal, administrator COMMAND access, console errors, broken media, reduced motion, zoom, and failure states.

| Surface | Tester and environment | Evidence | Result |
| --- | --- | --- | --- |
| Safari desktop | Basic render and entrance passed on 2026-08-20; full matrix outstanding |  | PARTIAL |
| Firefox desktop |  |  | HOLD |
| Real iPhone |  |  | HOLD |
| Physical tablet |  |  | HOLD |
| Keyboard-only |  |  | HOLD |
| VoiceOver/NVDA |  |  | HOLD |
| Reduced motion / 200% zoom |  |  | HOLD |

## 3. Recovery and operations

| Gate | Required evidence | Owner | Evidence/date | Result |
| --- | --- | --- | --- | --- |
| Account recovery | Approved test inbox receives message; link returns only to approved preview; session completes safely |  |  | HOLD |
| Inquiry delivery | Marked test reaches approved internal recipient; no real customer contacted |  |  | HOLD |
| Backup export | Timestamped export, checksum, encrypted storage location, retention owner |  |  | HOLD |
| Isolated restore | Restore into isolated non-production target; migration count, row counts, RLS, Auth and smoke checks |  |  | HOLD |
| Monitoring | Synthetic preview check and deploy/form/Auth/database alerts reach named escalation owner |  |  | HOLD |
| Incident response | Named primary/secondary, acknowledgement target, rollback authority and test receipt |  |  | HOLD |

Local schema reconstruction currently passes all 13 migrations and 43/43 invariants. That does not substitute for a real data export and isolated restore.

## 4. Legal and Founder decision

| Approval | Named approver | Exact document/candidate | Date | Evidence | Result |
| --- | --- | --- | --- | --- | --- |
| Terms |  | Terms v1.0 replacement |  |  | HOLD |
| Privacy |  | Privacy notice for enabled account/Auth behavior |  |  | HOLD |
| Research-use language |  | Exact preview |  |  | HOLD |
| Operations/recovery |  | Exact runbooks and receipts |  |  | HOLD |
| Founder |  | `494835ad…` / `6a87431c…` |  |  | HOLD |

## 5. Rollback identities

- Candidate parent: `801b95633bfd26d0f0cd912f2d49b5bd3c2b17a1`
- Previous connected preview: `6a873a67c7878a5bdba432ff`
- Current production observed: Git merge `780249bf46e0b1e7ddd43ce26899833141f99f28`; deploy `6a871f9299c9d8000863e666`
- Preserved prior production rollback: commit `65a2ac8f61d3595e5258cd3c5a747be4d651307e`; deploy `6a8682629962070009eaf22c`

No rollback, merge, production promotion, DNS change, commerce activation, customer submission, deletion, or archival action is authorized by this receipt.

## Final decision

**NO-GO until every HOLD above has direct evidence and the Founder approves the exact candidate.**
