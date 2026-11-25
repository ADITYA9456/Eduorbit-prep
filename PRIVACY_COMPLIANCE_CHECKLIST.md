# Privacy and compliance readiness (India)

This is a **technical readiness assessment**, not legal advice and not a statement that the business is compliant.
Source code changes alone cannot make a business compliant; each row says who has to act. Items marked LAWYER need a
qualified Indian technology/privacy lawyer. Do not publish the drafts in `legal/` until placeholders are filled and reviewed.

Legend: TECH = code/config, DOC = legal text, PROC = organisational process, EXT = provider setting, LAWYER.

## A. DPDP Act 2023 and DPDP Rules 2025

The Act is being brought into force in phases. Confirm which duties apply on which dates with your adviser; this table does not assume any provision is already in force.

| Area | Finding | Type | Status |
|---|---|---|---|
| Personal data inventory | Name, email, picture, Google ID; branches, countdown date; progress, notes; test answers, scores, timings, tab-leave count; request logs. Listed in `legal/PRIVACY_POLICY_DRAFT.md` | DOC | Drafted |
| Purpose and minimisation | Data is used to run the product. No analytics, ads or trackers found in the code | TECH | Looks fine; re-check before adding analytics |
| Privacy notice and consent | No privacy notice or consent text exists in the app; sign-in shows none | DOC, TECH, LAWYER | **Not done** (draft only) |
| Withdrawal / erasure | Account deletion implemented (`DELETE /api/account`), cascades to progress, notes, attempts | TECH | Done, not tested signed in |
| Access / copy of data | Export implemented (`GET /api/account`) | TECH | Done, not tested signed in |
| Correction | Users can edit notes, branches, countdown; name and email come from Google and are refreshed on sign-in. No other correction channel | PROC | Provide a contact |
| Retention | No automatic deletion of old data; only user-initiated deletion. Admin audit log has no purge | PROC, TECH | **Decision needed** |
| Processors and cross-border | Google, Supabase (region unknown), hosting provider, Anthropic (admin uploads only, no student data) | EXT, LAWYER | Confirm regions and agreements |
| Security safeguards | See SECURITY_AUDIT.md | TECH | Improved, risks remain |
| Breach response | `SECURITY_INCIDENT_RESPONSE.md` | PROC | Drafted; fill in contacts |
| Children (under 18) | The audience is exam candidates, many may be minors. No age gate or parental-consent flow exists. The DPDP Act restricts tracking and requires verifiable parental consent for children | DOC, TECH, LAWYER | **Open decision** |
| Grievance officer | No contact published | DOC | **Not done** |

## B. CERT-In directions (28 April 2022)

| Duty | Finding | Type | Status |
|---|---|---|---|
| Report listed incidents within 6 hours | Procedure written in the incident document | PROC | Drafted |
| Keep logs for 180 days (in India) | App logs only to hosting stdout; audit table covers admin actions only; hosting retention unknown | EXT | **Check provider settings** |
| Clock synchronisation | Depends on host | EXT | Not assessed |
| Point of contact | None published | PROC | **Not done** |
| Applicability | Depends on whether you are a service provider/body corporate under the directions | LAWYER | Confirm |

## C. IT Act and intermediary rules
The product has no user-generated public content (notes are private), so most intermediary content duties may not apply, but grievance contact, terms and a takedown path are still advisable. Drafts are in `legal/TERMS_AND_COPYRIGHT_DRAFT.md`. LAWYER to confirm status.

## D. Intellectual property

| Content | Risk | Action |
|---|---|---|
| Previous-year papers (linked or embedded from official sites and Drive) | Third-party copyright; embedding is not a licence | LAWYER / owner to confirm permission per source |
| Question banks built from uploaded images and PDFs | Owner of the source material may object | Add an uploader ownership declaration (not implemented; wording needs approval) |
| Answer keys and explanations | Same | Same |
| AI-extracted text | May reproduce source text exactly | Same as above; verify accuracy before publishing |
| Takedown process | Draft only | Publish contact and policy |

## E. Payments and consumer protection
Not applicable: no payments or subscriptions exist.

## F. Legal document inventory

| Document | Exists in app? |
|---|---|
| Privacy Policy | No (draft in `legal/`) |
| Terms and Conditions | No (draft in `legal/`) |
| Cookie notice | Not needed while only essential cookies are used (NextAuth session, admin cookie, theme in localStorage); re-check if analytics are added |
| Refund policy | N/A |
| Acceptable use / Community guidelines | Section in terms draft |
| Copyright and takedown policy | Draft |
| Grievance contact | No |
| Security disclosure policy | `SECURITY.md` (contact placeholder) |

## G. Needs human or lawyer decisions
Minimum age and parental consent; governing law and courts; retention periods; grievance officer; content licences; consent wording; cross-border statement; whether CERT-In and DPDP significant-fiduciary duties apply.
