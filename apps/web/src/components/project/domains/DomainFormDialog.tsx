import { useState } from "react";
import * as api from "../../../api/client";
import type { CreateDomainInput, Domain, DomainTlsMode } from "../../../types";
import { Button } from "../../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Input } from "../../ui/input";

interface DomainFormDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	projectId: string;
	isCompose: boolean;
	editing: Domain | null;
	onSaved: (domain: string) => void;
}

interface FormState {
	domain: string;
	targetService: string;
	targetPort: string;
	cloudflareProxied: boolean;
	tlsMode: DomainTlsMode;
	certificate: string;
	certificateKey: string;
	basicAuthUser: string;
	basicAuthPassword: string;
	httpsRedirect: boolean;
	gzip: boolean;
	noindex: boolean;
	wwwRedirect: boolean;
	pathPrefix: string;
	stripPrefix: boolean;
	rawSnippet: string;
}

const emptyForm: FormState = {
	domain: "",
	targetService: "",
	targetPort: "",
	cloudflareProxied: false,
	tlsMode: "auto",
	certificate: "",
	certificateKey: "",
	basicAuthUser: "",
	basicAuthPassword: "",
	httpsRedirect: true,
	gzip: true,
	noindex: false,
	wwwRedirect: false,
	pathPrefix: "",
	stripPrefix: false,
	rawSnippet: "",
};

const fromDomain = (domain: Domain): FormState => ({
	domain: domain.domain,
	targetService: domain.targetService || "",
	targetPort: domain.targetPort ? String(domain.targetPort) : "",
	cloudflareProxied: domain.cloudflareProxied ?? false,
	tlsMode: domain.tlsMode || "auto",
	certificate: "",
	certificateKey: "",
	basicAuthUser: domain.basicAuthUser || "",
	basicAuthPassword: "",
	httpsRedirect: domain.httpsRedirect ?? true,
	gzip: domain.gzip ?? true,
	noindex: domain.noindex ?? false,
	wwwRedirect: domain.wwwRedirect ?? false,
	pathPrefix: domain.pathPrefix || "",
	stripPrefix: domain.stripPrefix ?? false,
	rawSnippet: domain.rawSnippet || "",
});

export function DomainFormDialog({
	open,
	onOpenChange,
	projectId,
	isCompose,
	editing,
	onSaved,
}: DomainFormDialogProps) {
	const [form, setForm] = useState<FormState>(emptyForm);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [showAdvanced, setShowAdvanced] = useState(false);

	const handleOpenChange = (next: boolean) => {
		if (next) {
			setForm(editing ? fromDomain(editing) : emptyForm);
			setError("");
			setShowAdvanced(false);
		}
		onOpenChange(next);
	};

	const patch = (value: Partial<FormState>) => setForm((current) => ({ ...current, ...value }));

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!form.domain.trim()) return;
		setSaving(true);
		setError("");

		const payload: CreateDomainInput = {
			domain: form.domain.trim(),
			targetService: form.targetService.trim() || null,
			targetPort: form.targetPort ? Number(form.targetPort) : null,
			cloudflareProxied: form.cloudflareProxied,
			tlsMode: form.tlsMode,
			certificate: form.tlsMode === "custom" ? form.certificate.trim() || undefined : undefined,
			certificateKey: form.tlsMode === "custom" ? form.certificateKey.trim() || undefined : undefined,
			basicAuthUser: form.basicAuthUser.trim() || null,
			basicAuthPassword: form.basicAuthPassword || null,
			httpsRedirect: form.httpsRedirect,
			gzip: form.gzip,
			noindex: form.noindex,
			wwwRedirect: form.wwwRedirect,
			pathPrefix: form.pathPrefix.trim() || null,
			stripPrefix: form.stripPrefix,
			rawSnippet: form.rawSnippet.trim() || null,
		};

		try {
			if (editing) {
				const update: Partial<CreateDomainInput> = { ...payload };
				if (editing.hasCustomCertificate && !payload.certificate) {
					delete update.certificate;
					delete update.certificateKey;
				}
				if (editing.hasBasicAuthPassword && !payload.basicAuthPassword) {
					delete update.basicAuthPassword;
				}
				await api.updateDomain(editing.id, update);
			} else {
				await api.createDomainAdvanced(projectId, payload);
			}
			onSaved(payload.domain);
			onOpenChange(false);
		} catch (err: any) {
			setError(err.message || "Failed to save domain");
		} finally {
			setSaving(false);
		}
	};

	const toggle = (label: string, description: string, checked: boolean, onChange: (value: boolean) => void) => (
		<label className="flex items-start gap-3 cursor-pointer select-none rounded-xl border border-border/60 bg-[#0d0d11] p-3">
			<input
				type="checkbox"
				checked={checked}
				onChange={(e) => onChange(e.target.checked)}
				className="mt-0.5 h-4 w-4 rounded border-input bg-card text-primary focus:ring-primary cursor-pointer shrink-0"
			/>
			<span className="min-w-0">
				<span className="block text-xs font-semibold text-foreground">{label}</span>
				<span className="block text-[11px] text-muted-foreground leading-normal">{description}</span>
			</span>
		</label>
	);

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto bg-card border-border text-foreground rounded-2xl shadow-2xl">
				<DialogHeader>
					<DialogTitle className="text-lg font-bold text-foreground">
						{editing ? "Edit Domain" : "Add Custom Domain"}
					</DialogTitle>
					<DialogDescription className="text-xs text-muted-foreground">
						Route external web requests to your container with TLS, auth, and path controls.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4 pt-2">
					{error && (
						<div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs">{error}</div>
					)}

					<div className="grid gap-2">
						<label
							htmlFor="domain-address"
							className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
						>
							Domain Address
						</label>
						<Input
							id="domain-address"
							placeholder="e.g. app.mycompany.com"
							value={form.domain}
							onChange={(e) => patch({ domain: e.target.value })}
							className="h-10 bg-[#0d0d11] border-input focus:ring-2 focus:ring-primary text-sm font-semibold rounded-lg font-mono"
							disabled={!!editing}
							required
						/>
					</div>

					{isCompose && (
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
							<div className="grid gap-1.5">
								<label
									htmlFor="domain-service"
									className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider"
								>
									Service Name
								</label>
								<Input
									id="domain-service"
									placeholder="e.g. api or web"
									value={form.targetService}
									onChange={(e) => patch({ targetService: e.target.value })}
									className="h-9 bg-[#0d0d11] border-input text-xs font-mono rounded-lg"
								/>
							</div>
							<div className="grid gap-1.5">
								<label
									htmlFor="domain-port"
									className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider"
								>
									Service Port
								</label>
								<Input
									id="domain-port"
									placeholder="e.g. 8080"
									type="number"
									value={form.targetPort}
									onChange={(e) => patch({ targetPort: e.target.value })}
									className="h-9 bg-[#0d0d11] border-input text-xs font-mono rounded-lg"
								/>
							</div>
						</div>
					)}

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<div className="grid gap-1.5">
							<label
								htmlFor="domain-tls"
								className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider"
							>
								TLS Mode
							</label>
							<select
								id="domain-tls"
								value={form.tlsMode}
								onChange={(e) => patch({ tlsMode: e.target.value as DomainTlsMode })}
								className="h-9 w-full rounded-lg border border-input bg-[#0d0d11] px-3 text-xs text-foreground focus:border-primary focus:outline-none"
							>
								<option value="auto">Automatic (Let's Encrypt)</option>
								<option value="custom">Custom certificate</option>
								<option value="dns">DNS challenge</option>
							</select>
						</div>
						<div className="grid gap-1.5">
							<label
								htmlFor="domain-path-prefix"
								className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider"
							>
								Path Prefix
							</label>
							<Input
								id="domain-path-prefix"
								placeholder="e.g. /app"
								value={form.pathPrefix}
								onChange={(e) => patch({ pathPrefix: e.target.value })}
								className="h-9 bg-[#0d0d11] border-input text-xs font-mono rounded-lg"
							/>
						</div>
					</div>

					{form.tlsMode === "custom" && (
						<div className="grid gap-3 p-3 rounded-xl border border-border/60 bg-[#0d0d11]">
							<div className="grid gap-1.5">
								<label
									htmlFor="domain-cert"
									className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider"
								>
									Certificate (PEM)
								</label>
								<textarea
									id="domain-cert"
									value={form.certificate}
									onChange={(e) => patch({ certificate: e.target.value })}
									placeholder={
										editing?.hasCustomCertificate
											? "Stored certificate - leave blank to keep"
											: "-----BEGIN CERTIFICATE-----"
									}
									rows={3}
									className="w-full rounded-lg border border-input bg-[#0d0d11] px-3 py-2 text-[11px] text-foreground font-mono focus:border-primary focus:outline-none"
								/>
							</div>
							<div className="grid gap-1.5">
								<label
									htmlFor="domain-key"
									className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider"
								>
									Private Key (PEM)
								</label>
								<textarea
									id="domain-key"
									value={form.certificateKey}
									onChange={(e) => patch({ certificateKey: e.target.value })}
									placeholder={
										editing?.hasCustomCertificate ? "Stored key - leave blank to keep" : "-----BEGIN PRIVATE KEY-----"
									}
									rows={3}
									className="w-full rounded-lg border border-input bg-[#0d0d11] px-3 py-2 text-[11px] text-foreground font-mono focus:border-primary focus:outline-none"
								/>
							</div>
						</div>
					)}

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<div className="grid gap-1.5">
							<label
								htmlFor="domain-auth-user"
								className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider"
							>
								Basic Auth User
							</label>
							<Input
								id="domain-auth-user"
								placeholder="optional"
								value={form.basicAuthUser}
								onChange={(e) => patch({ basicAuthUser: e.target.value })}
								className="h-9 bg-[#0d0d11] border-input text-xs rounded-lg"
							/>
						</div>
						<div className="grid gap-1.5">
							<label
								htmlFor="domain-auth-password"
								className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider"
							>
								Basic Auth Password
							</label>
							<Input
								id="domain-auth-password"
								type="password"
								placeholder={editing?.hasBasicAuthPassword ? "Stored password - leave blank to keep" : "optional"}
								value={form.basicAuthPassword}
								onChange={(e) => patch({ basicAuthPassword: e.target.value })}
								className="h-9 bg-[#0d0d11] border-input text-xs rounded-lg"
							/>
						</div>
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
						{toggle(
							"Cloudflare Proxy",
							"Restore real client IPs when proxied through Cloudflare.",
							form.cloudflareProxied,
							(v) => patch({ cloudflareProxied: v }),
						)}
						{toggle("HTTPS Redirect", "Redirect plain HTTP requests to HTTPS.", form.httpsRedirect, (v) =>
							patch({ httpsRedirect: v }),
						)}
						{toggle("Gzip Compression", "Compress text responses at the proxy.", form.gzip, (v) => patch({ gzip: v }))}
						{toggle("No Index", "Send X-Robots-Tag to keep this domain out of search engines.", form.noindex, (v) =>
							patch({ noindex: v }),
						)}
						{toggle("WWW Redirect", "Redirect apex requests to the www host.", form.wwwRedirect, (v) =>
							patch({ wwwRedirect: v }),
						)}
						{toggle("Strip Prefix", "Remove the path prefix before proxying upstream.", form.stripPrefix, (v) =>
							patch({ stripPrefix: v }),
						)}
					</div>

					<div className="space-y-2">
						<button
							type="button"
							onClick={() => setShowAdvanced((v) => !v)}
							className="text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
						>
							{showAdvanced ? "Hide raw Caddy snippet" : "Show raw Caddy snippet"}
						</button>
						{showAdvanced && (
							<textarea
								value={form.rawSnippet}
								onChange={(e) => patch({ rawSnippet: e.target.value })}
								placeholder="Extra Caddy directives injected into this site block"
								rows={4}
								className="w-full rounded-lg border border-input bg-[#0d0d11] px-3 py-2 text-[11px] text-foreground font-mono focus:border-primary focus:outline-none"
							/>
						)}
					</div>

					<div className="flex justify-end gap-2 pt-2 border-t border-border/40">
						<Button
							type="button"
							variant="ghost"
							onClick={() => onOpenChange(false)}
							className="h-10 text-xs px-4 rounded-xl hover:bg-[#1a1a21]"
							disabled={saving}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={saving}
							className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-10 text-xs px-5 rounded-xl shadow-lg hover:shadow-primary/20 transition-all"
						>
							{saving ? "Saving..." : editing ? "Save Domain" : "Add Domain"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
