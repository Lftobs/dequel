import type { QueryExecResult } from "../../../types";
import { Badge } from "../../ui/badge";

interface StructureViewProps {
	selectedTable: string | null;
	dataResult: QueryExecResult | null;
}

export function StructureView({ selectedTable, dataResult }: StructureViewProps) {
	return (
		<div className="border border-border/60 bg-card/60 rounded-3xl p-5 space-y-4 backdrop-blur-md shadow-xl">
			<h3 className="text-xs font-bold text-foreground font-mono">
				Columns & Schema Structure for &quot;{selectedTable || "table"}&quot;
			</h3>
			{!dataResult || dataResult.columns.length === 0 ? (
				<p className="text-xs text-muted-foreground py-6 text-center">No column structure details available.</p>
			) : (
				<div className="overflow-x-auto rounded-2xl border border-border/40 font-mono text-xs">
					<table className="w-full text-left border-collapse">
						<thead className="bg-black/40 text-muted-foreground border-b border-border/40">
							<tr>
								<th className="p-3">Column Name</th>
								<th className="p-3">Inferred Type</th>
								<th className="p-3">Sample Value</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border/20 bg-background/20">
							{dataResult.columns.map((col) => {
								const sampleVal = dataResult.rows[0]?.[col];
								const sampleType = typeof sampleVal;
								return (
									<tr key={col} className="hover:bg-white/5">
										<td className="p-3 font-semibold text-foreground">{col}</td>
										<td className="p-3">
											<Badge variant="outline" className="text-[10px] uppercase border-border/60 font-mono">
												{sampleType === "number" ? "numeric" : sampleType === "boolean" ? "boolean" : "text"}
											</Badge>
										</td>
										<td className="p-3 text-muted-foreground max-w-xs truncate">
											{sampleVal === null ? "NULL" : String(sampleVal ?? "")}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
