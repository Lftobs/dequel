import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, LayoutTemplate } from "lucide-react";
import { TemplateFlow } from "../components/templates/TemplateFlow";

export function TemplatesPage() {
	const navigate = useNavigate();

	const navigateToDeployments = (projectId: string) =>
		navigate({ to: "/project/$projectId", params: { projectId }, search: { tab: "deployments", section: undefined } });

	return (
		<div className="min-h-screen bg-[#070709] text-zinc-100 p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
			<div className="border-b border-[#181820] pb-6">
				<button
					type="button"
					onClick={() => navigate({ to: "/" })}
					className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-100 transition-colors mb-3 sm:hidden"
				>
					<ArrowLeft className="h-3.5 w-3.5" />
					Back to Dashboard
				</button>
				<div className="flex items-center gap-3">
					<span className="grid place-items-center h-10 w-10 rounded-xl bg-orange-500/10 border border-orange-500/20">
						<LayoutTemplate className="h-5 w-5 text-orange-500" />
					</span>
					<div>
						<h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Templates</h1>
						<p className="text-xs sm:text-sm text-zinc-400">
							One-click deployments for popular self-hosted apps with automatic routing and SSL.
						</p>
					</div>
				</div>
			</div>

			<TemplateFlow onDeployed={navigateToDeployments} wide showHeading={false} />
		</div>
	);
}
