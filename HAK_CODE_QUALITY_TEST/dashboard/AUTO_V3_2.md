# HAK Dashboard V3.2 — Auto JSON

## Run locally

1. Create `HAK_CODE_QUALITY_TEST/dashboard/reports/`.
2. Extract GitHub Actions artifact ZIPs into subfolders such as `reports/run-001/` and `reports/run-002/`.
3. Run `python HAK_CODE_QUALITY_TEST/dashboard/serve.py` from the repository root.
4. Open `http://127.0.0.1:8765/auto.html` and press **Tải lại báo cáo** after adding new files.

The server binds only to `127.0.0.1` and does not need Internet. It reads recognized report filenames, ignores large files and symbolic links, and returns their JSON to the local browser. It does not download GitHub artifacts automatically.

**Security:** Treat report files as confidential. Do not expose this server to a LAN or Internet. The reports endpoint has no authentication and may include internal source paths. This tool is for a trusted local workstation only. Avoid placing private reports in public web directories or Git commits.

**Scope:** Auto-import and summary only. Cross-run comparisons still use `history.html` with manual selection. No persistent database or CI artifact syncing yet.
