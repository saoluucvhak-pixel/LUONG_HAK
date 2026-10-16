# HAK Architecture Analyzer V1

Static dependency and change-impact analysis for Python and JavaScript/TypeScript. Does not execute project code.

Usage:
```bash
python HAK_CODE_QUALITY_TEST/architecture_analyzer.py --root . --changed src/core.py --out architecture.json
```

Outputs a dependency graph, detected import cycles and modules potentially affected by changed files. Relative JS imports and basic Python imports are supported.

Limitations: no dynamic imports, TypeScript path aliases, bundler resolution, Apps Script global function call graphs, or cross-service data lineage yet. Impact results are conservative only for the edges that can be resolved; missing edges can cause under-reporting. Review before refactoring. This module is independently implemented and does not incorporate Graphify source.
