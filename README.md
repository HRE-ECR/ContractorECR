# ContractorECR

Changes in v0.4.3
- Nav bar is responsive and no longer squashed on the landing page.
- Dashboard: added Refresh button.
- Dashboard: On-site table shows "Signed in by".
- Wherever emails are displayed for sign-in/out, the domain is removed (e.g. jason.edwards@hitachirail.com -> jason.edwards).

Important build notes
- Keep csvEscape regex on one line.
- Keep CSV join as `.join('\n')` (must not become a real line-break in quotes).
