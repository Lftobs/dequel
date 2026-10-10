import { ARCH_STEPS } from "./archData";

export function initArchController() {
	const pills = document.querySelectorAll<HTMLButtonElement>(".dq-step-pill");
	const explTag = document.getElementById("dq-expl-tag");
	const explTitle = document.getElementById("dq-expl-title");
	const explDesc = document.getElementById("dq-expl-desc");
	const explMetric = document.getElementById("dq-expl-metric");
	const chipV3 = document.getElementById("dq-chip-v3");
	const chipV4 = document.getElementById("dq-chip-v4");

	if (!pills.length) return;

	let currentStep = 1;
	let timer: ReturnType<typeof setInterval> | null = null;

	function renderStep(stepIndex: number) {
		currentStep = stepIndex;
		const data = ARCH_STEPS.find((s) => s.step === stepIndex) || ARCH_STEPS[0];

		// 1. Update Stepper Buttons
		pills.forEach((p) => {
			const val = Number(p.getAttribute("data-step"));
			p.classList.toggle("active", val === stepIndex);
		});

		// 2. Update Explanation Card
		if (explTag) explTag.textContent = data.tag;
		if (explTitle) explTitle.textContent = data.title;
		if (explDesc) explDesc.textContent = data.desc;
		if (explMetric) {
			const label = explMetric.querySelector("span:last-child");
			if (label) label.textContent = data.metric;
		}

		// 3. Update Connecting Circuit Pipes & Progressing Flow Beams
		document.querySelectorAll(".dq-pipe").forEach((p) => {
			p.classList.remove("dq-pipe-active");
		});
		document.querySelectorAll(".dq-beam").forEach((b) => {
			b.classList.remove("dq-beam-active");
		});
		data.activePipes.forEach((id) => {
			const pipe = document.getElementById(id);
			if (pipe) pipe.classList.add("dq-pipe-active");
			const beamId = id.replace("dq-path-", "dq-beam-");
			const beam = document.getElementById(beamId);
			if (beam) beam.classList.add("dq-beam-active");
		});

		// 4. Update Node Halos & Outlines
		document.querySelectorAll(".block-rect, .pill-rect, .visitors-rect, .snapshot-rect, .aux-rect").forEach((el) => {
			el.classList.remove("block-active");
		});

		data.activeNodes.forEach((id) => {
			const container = document.getElementById(id);
			if (container) {
				const rects = container.querySelectorAll(".block-rect, .pill-rect, .visitors-rect, .snapshot-rect, .aux-rect");
				rects.forEach((r) => r.classList.add("block-active"));
			}
		});

		// 5. Version Snapshot Rollback Toggle
		if (chipV3 && chipV4) {
			if (stepIndex === 6) {
				chipV3.setAttribute("fill", "#ea580c");
				chipV3.setAttribute("stroke", "#ea580c");
				chipV4.setAttribute("fill", "#141418");
				chipV4.setAttribute("stroke", "#222228");
			} else {
				chipV3.setAttribute("fill", "#141418");
				chipV3.setAttribute("stroke", "#222228");
				chipV4.setAttribute("fill", "#ea580c");
				chipV4.setAttribute("stroke", "#ea580c");
			}
		}
	}

	function startTimer() {
		if (timer) clearInterval(timer);
		timer = setInterval(() => {
			const next = currentStep >= 6 ? 1 : currentStep + 1;
			renderStep(next);
		}, 4500);
	}

	function resetTimer() {
		if (timer) clearInterval(timer);
		startTimer();
	}

	// Click listeners on stepper pills
	pills.forEach((p) => {
		p.addEventListener("click", () => {
			const s = Number(p.getAttribute("data-step"));
			if (s) {
				renderStep(s);
				resetTimer();
			}
		});
	});

	// Click listeners on interactive SVG nodes
	document.querySelectorAll("[data-step]").forEach((el) => {
		if (!el.classList.contains("dq-step-pill")) {
			el.addEventListener("click", () => {
				const s = Number(el.getAttribute("data-step"));
				if (s) {
					renderStep(s);
					resetTimer();
				}
			});
		}
	});

	// Initial render & run
	renderStep(1);
	startTimer();
}
