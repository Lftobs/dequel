import { Input } from "../../ui/input";
import { Box } from "lucide-react";
import type { GithubRepo } from "../../../types";
import { StepBasicsGeneralSettings } from "./StepBasicsGeneralSettings";
import { StepBasicsSourceSection } from "./StepBasicsSourceSection";
import type { FrameworkPreset } from "../../../utils/presets";

interface StepBasicsProps {
	name: string;
	setName: (v: string) => void;
	description: string;
	setDescription: (v: string) => void;
	baseDomain: string;
	setBaseDomain: (v: string) => void;
	repoUrl: string;
	setRepoUrl: (v: string) => void;
	repoBranch: string;
	setRepoBranch: (v: string) => void;
	sourceDir: string;
	setSourceDir: (v: string) => void;
	selectedRepo: GithubRepo | null;
	setSelectedRepo: (v: GithubRepo | null) => void;
	onGithubConnected: () => boolean;
	githubConfigured: boolean;
	sourceType: string;
	setSourceType: (v: string) => void;
	projectType: string;
	setProjectType: (v: string) => void;
	port: string;
	setPort: (v: string) => void;
	zipFile: File | null;
	setZipFile: (v: File | null) => void;
	selectedPresetId: string;
	onSelectPreset: (preset: FrameworkPreset) => void;
}

export function StepBasics({
	name,
	setName,
	description,
	setDescription,
	baseDomain,
	setBaseDomain,
	repoUrl,
	setRepoUrl,
	repoBranch,
	setRepoBranch,
	sourceDir,
	setSourceDir,
	selectedRepo,
	setSelectedRepo,
	onGithubConnected,
	githubConfigured,
	sourceType,
	setSourceType,
	projectType,
	setProjectType,
	port,
	setPort,
	zipFile,
	setZipFile,
	selectedPresetId,
	onSelectPreset,
}: StepBasicsProps) {
	return (
		<div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
			<StepBasicsGeneralSettings
				name={name}
				setName={setName}
				description={description}
				setDescription={setDescription}
				baseDomain={baseDomain}
				setBaseDomain={setBaseDomain}
				projectType={projectType}
				setProjectType={setProjectType}
				selectedPresetId={selectedPresetId}
				onSelectPreset={onSelectPreset}
			/>

			<StepBasicsSourceSection
				sourceType={sourceType}
				setSourceType={setSourceType}
				selectedRepo={selectedRepo}
				setSelectedRepo={setSelectedRepo}
				repoUrl={repoUrl}
				setRepoUrl={setRepoUrl}
				repoBranch={repoBranch}
				setRepoBranch={setRepoBranch}
				sourceDir={sourceDir}
				setSourceDir={setSourceDir}
				zipFile={zipFile}
				setZipFile={setZipFile}
				githubConfigured={githubConfigured}
				githubConnected={onGithubConnected()}
				onGithubConnected={onGithubConnected}
			/>

			<div className="space-y-3.5 bg-[#0c0c0e]/60 p-4 rounded-xl border border-[#222227]">
				<h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
					<Box className="h-3.5 w-3.5 text-amber-500" />
					Container Port
				</h4>
				<div className="grid gap-3.5 sm:grid-cols-2 text-xs">
					<div className="grid gap-1.5 sm:col-span-2">
						<label
							htmlFor="port"
							className="font-semibold text-zinc-400"
						>
							Application Port *
						</label>
						<Input
							id="port"
							type="number"
							min="1"
							max="65535"
							placeholder="e.g. 3000"
							className="bg-[#141418] border-[#222227] focus:border-amber-500 text-zinc-200 h-9"
							value={port}
							onChange={(e) =>
								setPort(e.target.value)
							}
						/>
					</div>
				</div>
				<div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-[11px] text-zinc-300 leading-relaxed">
					<strong className="text-amber-400">
						Important:
					</strong>{" "}
					Set this to the port your application
					listens on inside the container. If the
					port doesn't match, you'll get a{" "}
					<strong className="text-red-400">
						502 Bad Gateway
					</strong>{" "}
					error from the reverse proxy.
				</div>
			</div>
		</div>
	);
}
