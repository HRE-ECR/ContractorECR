# ContractorECR

This build fixes the GitHub Actions build error caused by a broken regex in Dashboard.jsx.

If you see an "Unterminated regular expression" error, ensure the line below is NOT split across lines:

```js
if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
```
