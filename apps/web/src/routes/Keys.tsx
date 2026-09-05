import { KeyRound } from "lucide-react";
import { ApiKeysSection } from "../components/settings/ApiKeysSection";
import { SshKeyPoolSection } from "../components/settings/SshKeyPoolSection";

export function Keys() {
	return (
		<div className="mx-auto max-w-6xl space-y-7">
			<div className="flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-end">
				<div>
					<p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-amber-500">Credentials</p>
					<h1 className="flex items-center gap-2 text-2xl font-semibold text-zinc-100">
						<KeyRound className="h-6 w-6 text-zinc-400" />
						API Keys & SSH Keys
					</h1>
					<p className="mt-2 max-w-2xl text-sm text-zinc-500">
						Manage CI/CD tokens and the SSH key pool used to connect to remote servers.
					</p>
				</div>
			</div>

			<div className="grid gap-6">
				<ApiKeysSection />
				<SshKeyPoolSection />
			</div>
		</div>
	);
}
