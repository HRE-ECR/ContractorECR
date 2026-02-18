# ContractorECR

v0.4.4 fixes
- Removed duplicate @vitejs/plugin-react key in package.json.
- Fixed GitHub Actions build break caused by regex being split across lines: csvEscape now uses no regex.
- Nav bar is responsive and no longer squashed.
- Dashboard: Refresh button.
- Dashboard: On-site table shows Signed in by.
- Signed in/out names drop the domain (e.g. jason.edwards@hitachirail.com -> jason.edwards).

CSV export note
- Uses join('\n') and does not rely on regex to avoid formatting-related build failures.
