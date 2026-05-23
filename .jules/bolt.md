## 2024-05-22 - Parallelize independent AI agent calls
**Learning:** In src/app/api/complaints/route.ts, multiple independent LLM calls (intakeAgent, classificationAgent, priorityAgent) were being executed sequentially. Since these don't depend on each other, running them sequentially blocks the request unnecessarily.
**Action:** Use Promise.all to run independent async operations concurrently to reduce overall latency, especially when dealing with external API calls like LLMs.
