# HAK Quality Dashboard V3.1

Open `history.html` locally. Choose multiple quality and architecture JSON reports.

Features: stacked bar history of passed/failed tests, comparison of two selected runs, and readable dependency adjacency view. No remote services, external scripts, execution of uploaded code, or persistence. User-provided text is rendered using textContent.

Limitations: file import order is treated as run order, not actual chronological time. Reports without embedded commit metadata are labeled by file name; do not treat filenames as verified commit identity. Dependency view is a list, not a force-directed graph. Comparison is meaningful only for equivalent test suites; the interface does not validate suite equivalence. There is no automatic retrieval of historical CI artifacts.

Manual test checklist: import two quality reports, verify counts; select A/B and check deltas; import architecture report; test malformed and oversized JSON; verify markup-looking module names are displayed as plain text.
