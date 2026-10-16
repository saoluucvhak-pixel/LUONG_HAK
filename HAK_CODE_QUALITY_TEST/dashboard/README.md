# HAK Quality Dashboard V3

Open `index.html` locally in a modern browser. No web server, external JavaScript library or Internet access is required.

Upload JSON artifacts produced by the HAK quality workflows:
- `hak-quality-results.json`
- `hak-security-results.json`
- `hak-architecture-results.json`
- `hak-skill-proposals.json`

The dashboard identifies report types by their schemas rather than filenames. It displays tests, security findings, dependency edges, cycles count and proposed skills. It does not execute, approve, or install skills.

Security: renders all untrusted report fields via `textContent` rather than `innerHTML`. Files remain in browser memory and are not transmitted. This UI is a single-run report viewer; it does not yet provide cross-run trends, persistent history, server-side authorization or Graphify's full graph visualization.

Manual acceptance checks: upload each report, confirm counts and table rows; upload malformed JSON; upload an HTML injection string and verify it displays as text; test narrow mobile layout.
