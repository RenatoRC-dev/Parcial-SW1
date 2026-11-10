# NexoCASE — 1-day demo resilience (read only on demand)

## Prioritize
1. Fix contextual imperative `Hazlo tú` and conversation chaining — avoid HTTP 500 / fake success.
2. Validate structured model bulk creation and clear schema commands; request clarification when business rules truly missing.
3. Groq provider: fix `400 json_validate_failed` schema path; reduce prompt context, use deterministic resolution and caching; bounded retry after genuine 429; optional validated fallback (no retry loop), manual degradation. Do not promise infinite access.
4. Display safe and readable chat using existing React/CSS without calling an LLM to reformat output.
5. Final QA (external to Codex): real Mongo, targeted E2E, live Groq with an account that has quota, save/reload, two browsers, failure demo.

## Local runtime
MongoDB (existing container `nexocase-mongo`): `docker ps --filter name=nexocase-mongo`.
Backend terminal in `backend/`: set `MONGODB_URI`, `MONGODB_DB_NAME`, `PROJECT_ACCESS_PEPPER`, `GROQ_API_KEY`; `npm run dev`.
Frontend terminal in `frontend/`: `npm run dev`, typically http://localhost:5173.
Do not duplicate Mongo container if it exists. Never paste key in output or code. A restarted backend must receive the environment again.

## Prove failure conditions
- User message persisted, model remains intact when provider unavailable or `429`.
- A previously planned action is not applied twice on retry.
- Advisory + an explicit `Hazlo` is not an autonomous AI change: separate human action authorizes it.
- Reconnection/load from Mongo doesn't invent a live Yjs save; CU11 save remains explicit.

## Provider purchasing decision — updated from Groq console / official docs
- For demo quality: **Developer + GPT-OSS 120B** for complex UML/reviews; GPT-OSS 20B for simple paths if trivial routing avoids extra calls. Do not promise 100% semantic correctness.
- `GROQ_MODEL=openai/gpt-oss-120b` is the simplest first demo smoke setting **after verifying provider schema and source code**; never assume changing only this env variable solves the entire application. If it fails, preserve known working 20B.
- Official Developer model baseline: **250K TPM / 1K RPM** for GPT-OSS 20B and 120B. Account limits may differ. Pay-as-you-go; no immediate charge on upgrade, but future usage is billed. User controls upgrade, cost caps and credentials; Codex must not do billing actions.
- Rates: GPT-OSS 20B **$0.075 input / $0.30 output per 1M**; GPT-OSS 120B **$0.15 input / $0.60 output per 1M**. Qwen3.8 27B remains preview and more expensive; not production default.
- Groq dashboard observed `400 json_validate_failed` and `429 rate_limit_exceeded`; logged successful input 2.3K–5.8K tokens/request. Debug runtime + strict schema, do not attribute every error to quota.
- Test live model once per controlled use case, avoid repeated real Groq smoke runs that burn quota. Demo test sequence: CU12 advisory -> structured recommendation -> "Hazlo tú" executes via CU04 -> verify diagram -> explicit save/reload -> second user Yjs. Capture sanitized log only.
- Use model switching and prompt caching only if tested; cache hits are **not guaranteed**. Both GPT-OSS models support automatic caching. If rate limited, preserve state and never auto-repeat non-idempotent actions.

Official refs (review only if needed):
https://console.groq.com/docs/models
https://console.groq.com/docs/rate-limits
https://console.groq.com/docs/structured-outputs
https://console.groq.com/docs/prompt-caching
https://console.groq.com/docs/billing-faqs
