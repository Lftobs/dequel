import { Card, CardContent } from "../../ui/card";
import { Button } from "../../ui/button";
import { X, Globe, Copy, Check } from "lucide-react";

interface DnsInstructionsCardProps {
	lastAdded: string;
	onDismiss: () => void;
	hasBaseDomain: boolean;
	dnsName: string;
	baseDomain: string;
	serverIp: { ip: string } | undefined;
	copiedTarget: boolean;
	onCopy: (text: string) => void;
}

export function DnsInstructionsCard({
	lastAdded,
	onDismiss,
	hasBaseDomain,
	dnsName,
	baseDomain,
	serverIp,
	copiedTarget,
	onCopy,
}: DnsInstructionsCardProps) {
	return (
		<Card className="border-primary/30 bg-primary/5 shadow-md shadow-primary/5">
			<CardContent className="p-4 sm:p-5 relative">
				<Button
					variant="ghost"
					size="icon"
					className="absolute top-2 right-2 h-6 w-6 text-muted-foreground hover:text-foreground"
					onClick={onDismiss}
				>
					<X className="h-4 w-4" />
				</Button>
				<div className="flex items-start gap-3.5">
					<Globe className="h-5 w-5 text-primary mt-0.5 shrink-0" />
					<div className="space-y-2.5 text-sm w-full min-w-0">
						<p className="font-semibold text-foreground break-all">
							DNS Configuration Required for{" "}
							<code className="text-primary font-mono">
								{lastAdded}
							</code>
						</p>
						{hasBaseDomain ? (
							<>
								<p className="text-xs text-muted-foreground">
									Add a CNAME record at your DNS domain registrar:
								</p>
								<div className="rounded-lg border border-border bg-[#070709] overflow-x-auto text-[10px] font-mono w-full">
									<table className="w-full min-w-[300px]">
										<thead>
											<tr className="bg-[#0b0b0f] text-left">
												<th className="px-3 py-1.5 text-muted-foreground font-semibold">
													Type
												</th>
												<th className="px-3 py-1.5 text-muted-foreground font-semibold">
													Host/Name
												</th>
												<th className="px-3 py-1.5 text-muted-foreground font-semibold">
													Target/Value
												</th>
											</tr>
										</thead>
										<tbody>
											<tr className="border-t border-border/40">
												<td className="px-3 py-2 text-foreground font-bold">
													CNAME
												</td>
												<td className="px-3 py-2 text-foreground">
													{dnsName}
												</td>
												<td className="px-3 py-2 text-foreground flex items-center justify-between gap-2">
													<span className="truncate max-w-[140px] sm:max-w-[200px]">
														{baseDomain}
													</span>
													<button
														type="button"
														onClick={() => onCopy(baseDomain)}
														className={`p-1 transition-colors ${copiedTarget ? "text-emerald-400" : "text-muted-foreground hover:text-foreground"}`}
													>
														{copiedTarget ? (
															<Check className="h-3 w-3" />
														) : (
															<Copy className="h-3 w-3" />
														)}
													</button>
												</td>
											</tr>
										</tbody>
									</table>
								</div>
								<p className="text-xs text-muted-foreground">
									Or point an A record directly to target IP:{" "}
									<code className="text-primary font-mono font-bold bg-[#0d0d11] px-1.5 py-0.5 rounded border border-border/50">
										{serverIp?.ip ?? "../.."}
									</code>
								</p>
							</>
						) : (
							<>
								<p className="text-xs text-muted-foreground">
									Add an A record at your DNS domain registrar:
								</p>
								<div className="rounded-lg border border-border bg-[#070709] overflow-x-auto text-[10px] font-mono w-full">
									<table className="w-full min-w-[300px]">
										<thead>
											<tr className="bg-[#0b0b0f] text-left">
												<th className="px-3 py-1.5 text-muted-foreground font-semibold">
													Type
												</th>
												<th className="px-3 py-1.5 text-muted-foreground font-semibold">
													Host/Name
												</th>
												<th className="px-3 py-1.5 text-muted-foreground font-semibold">
													Value
												</th>
											</tr>
										</thead>
										<tbody>
											<tr className="border-t border-border/40">
												<td className="px-3 py-2 text-foreground font-bold">
													A
												</td>
												<td className="px-3 py-2 text-foreground">
													{dnsName}
												</td>
												<td className="px-3 py-2 text-foreground flex items-center justify-between gap-2">
													<span>
														{serverIp?.ip ?? "../.."}
													</span>
													{serverIp?.ip && (
														<button
															type="button"
															onClick={() => onCopy(serverIp.ip)}
															className={`p-1 transition-colors ${copiedTarget ? "text-emerald-400" : "text-muted-foreground hover:text-foreground"}`}
														>
															{copiedTarget ? (
																<Check className="h-3 w-3" />
															) : (
																<Copy className="h-3 w-3" />
															)}
														</button>
													)}
												</td>
											</tr>
										</tbody>
									</table>
								</div>
							</>
						)}
						<p className="text-[10px] text-muted-foreground/80 leading-relaxed">
							DNS changes can take up to 48 hours to propagate globally. Dequel will validate SSL cert status automatically.
						</p>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
