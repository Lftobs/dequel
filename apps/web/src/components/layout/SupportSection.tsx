import { useEffect, useState } from "react";
import { Coffee } from "lucide-react";

export function SupportSection() {
	const [failedToLoad, setFailedToLoad] = useState(false);

	useEffect(() => {
		let active = true;

		const draw = () => {
			if (!active) return;
			const widget = (window as any).kofiWidgetOverlay;
			if (!widget?.draw) {
				setFailedToLoad(true);
				return;
			}
			try {
				const container = document.getElementById("kofi-widget-container");
				if (container) {
					container.innerHTML = "";
				}
				widget.draw(
					"rm_rf",
					{
						type: "floating-chat",
						"floating-chat.donateButton.text": "Buy me a coffee",
						"floating-chat.donateButton.background-color": "#FFDD00",
						"floating-chat.donateButton.text-color": "#000000",
					},
					"kofi-widget-container",
				);
				setFailedToLoad(false);
			} catch (e) {
				setFailedToLoad(true);
			}
		};

		const widget = (window as any).kofiWidgetOverlay;
		if (widget?.draw) {
			const t = setTimeout(draw, 0);
			return () => {
				active = false;
				clearTimeout(t);
			};
		}

		let script = document.getElementById("kofi-widget-overlay") as HTMLScriptElement | null;
		if (!script) {
			script = document.createElement("script");
			script.id = "kofi-widget-overlay";
			script.src = "https://storage.ko-fi.com/cdn/scripts/overlay-widget.js";
			script.async = true;
			document.body.appendChild(script);
		}

		const handleLoad = () => {
			setTimeout(draw, 0);
		};
		const handleError = () => {
			if (active) setFailedToLoad(true);
		};

		script.addEventListener("load", handleLoad);
		script.addEventListener("error", handleError);

		const timeoutId = setTimeout(() => {
			if (active) {
				const w = (window as any).kofiWidgetOverlay;
				if (!w?.draw) {
					setFailedToLoad(true);
				} else {
					draw();
				}
			}
		}, 6000);

		return () => {
			active = false;
			clearTimeout(timeoutId);
			if (script) {
				script.removeEventListener("load", handleLoad);
				script.removeEventListener("error", handleError);
			}
		};
	}, []);

	return (
		<div className="rounded-lg bg-gradient-to-r from-[#FFDD00]/5 to-amber-500/5 border border-[#FFDD00]/10 p-3 space-y-2 text-zinc-300 shadow-sm relative overflow-hidden group">
			<div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
				<Coffee className="h-3.5 w-3.5" />
				Support Dequel
			</div>
			<p className="text-[10px] text-zinc-400 leading-normal">
				Help keep Dequel open source and support its development!
			</p>

			<div id="kofi-widget-container" className="w-full relative z-10">
				{failedToLoad && (
					<a
						href="https://ko-fi.com/rm_rf"
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center justify-center gap-1.5 w-full bg-[#FFDD00] text-black font-semibold rounded-lg py-2 text-sm hover:bg-[#ffe42b] transition-colors shadow-sm select-none active:scale-[0.98]"
						style={{
							fontFamily: "'Cookie', cursive",
							fontSize: "16px",
							lineHeight: "20px",
						}}
					>
						Buy me a coffee
					</a>
				)}
			</div>
		</div>
	);
}
