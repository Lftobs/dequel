export interface ArchStep {
	step: number;
	tag: string;
	title: string;
	desc: string;
	metric: string;
	activePipes: string[];
	activeNodes: string[];
}

export const ARCH_STEPS: ArchStep[] = [
	{
		step: 1,
		tag: "STAGE 01: INGESTION",
		title: "01. Multi-Channel Trigger Ingestion",
		desc: "Push code via GitHub webhooks (`push to main`), the Web Dashboard, or upcoming CLI & Agent triggers. Webhooks spawn staging runners instantly.",
		metric: "Trigger: Instant Webhook",
		activePipes: ["dq-path-trigger-git", "dq-path-trigger-cli", "dq-path-trigger-web", "dq-path-trigger-ai"],
		activeNodes: ["dq-node-triggers", "dq-node-api"],
	},
	{
		step: 2,
		tag: "STAGE 02: ORCHESTRATION",
		title: "02. Redis Queue & API Control Plane",
		desc: "Dequel's ElysiaJS backend on Bun dispatches build jobs to Redis (`ioredis`), runs database migrations via Drizzle ORM, and records deployment state in PostgreSQL.",
		metric: "Queue: Redis ioredis",
		activePipes: ["dq-path-trigger-git", "dq-path-api-build"],
		activeNodes: ["dq-node-api", "dq-node-buildkit"],
	},
	{
		step: 3,
		tag: "STAGE 03: COMPILATION",
		title: "03. Railpack & BuildKit Layer Cache",
		desc: "Railpack inspects your repo to auto-detect language runtimes (Node, Bun, Go, Python, Rust, Docker) and compiles isolated OCI container layers with persistent BuildKit caching.",
		metric: "Build: Local Layer Cached",
		activePipes: ["dq-path-api-build", "dq-path-build-snapshot", "dq-path-build-runtime"],
		activeNodes: ["dq-node-buildkit", "dq-group-snapshots", "dq-node-app"],
	},
	{
		step: 4,
		tag: "STAGE 04: RUNTIME & NETWORK",
		title: "04. Isolated Docker Bridge & Databases",
		desc: "Docker spawns the app container onto the isolated `dequel_net` bridge. Managed PostgreSQL and Redis DB services connect automatically with zero manual networking.",
		metric: "Network: dequel_net Bridge",
		activePipes: ["dq-path-build-runtime", "dq-path-runtime-db"],
		activeNodes: ["dq-node-app", "dq-node-dbs"],
	},
	{
		step: 5,
		tag: "STAGE 05: EDGE INGRESS",
		title: "05. SNI Gateway & Caddy Auto-SSL",
		desc: "Host Gateway (:443) uses TLS SNI to route traffic to Caddy. Caddy reloads dynamic routes with zero downtime and provisions automated Let's Encrypt certificates for custom domains.",
		metric: "Ingress: Port 443 SNI + Caddy",
		activePipes: ["dq-path-runtime-caddy", "dq-path-gateway-caddy", "dq-path-caddy-users"],
		activeNodes: ["dq-node-app", "dq-node-caddy", "dq-node-gateway", "dq-node-users"],
	},
	{
		step: 6,
		tag: "STAGE 06: ROLLBACK & METRICS",
		title: "06. 1-Second Rollback & Telemetry",
		desc: "Revert anytime to previous immutable image snapshots in under 1 second without rebuilding. Meanwhile, cAdvisor and Prometheus continuously stream resource telemetry for auto-scaling.",
		metric: "Rollback: < 1 Second",
		activePipes: ["dq-path-build-snapshot", "dq-path-telemetry"],
		activeNodes: ["dq-group-snapshots", "dq-node-app", "dq-node-api"],
	},
];
