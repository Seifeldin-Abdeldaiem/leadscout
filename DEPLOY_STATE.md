# Deploy state

- Slug: `leadscout`. Render service: `leadscout-k7q2` (free plan, Frankfurt)
- Expected URL: https://leadscout-k7q2.onrender.com (health check at `/api/health`)
- Secrets to enter: none
- Phase: 6, publishing. Code is built and verified locally; waiting for the GitHub push and the Render deploy click.
- Local verification: lint ✅, typecheck ✅, 33 unit tests ✅, production build ✅, live searches against OSM (London, Manchester) ✅, UI screenshots at desktop and mobile widths ✅, `render.yaml` schema ✅, actionlint ✅
- Not run: Docker (not used by this app). CI runs on the first push.
- Next: once deployed, `curl https://leadscout-k7q2.onrender.com/api/health` and run a live search.
