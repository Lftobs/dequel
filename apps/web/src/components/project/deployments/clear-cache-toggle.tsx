interface ClearCacheToggleProps {
	checked: boolean;
	onChange: (checked: boolean) => void;
	id?: string;
	label?: string;
	description?: string;
}

export function ClearCacheToggle({
	checked,
	onChange,
	id = "clearCache",
	label = "Clear build cache for this deployment",
	description,
}: ClearCacheToggleProps) {
	return (
		<div className="flex items-center gap-2.5 p-3 rounded-lg bg-[#121215]/50 border border-[#222227]/50">
			<input
				type="checkbox"
				id={id}
				checked={checked}
				onChange={(e) => onChange(e.target.checked)}
				className="h-4 w-4 rounded border-zinc-700 bg-zinc-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-zinc-950 cursor-pointer"
			/>
			<div className="flex flex-col cursor-pointer select-none" onClick={() => onChange(!checked)}>
				<label
					htmlFor={id}
					className={`cursor-pointer ${description ? "text-xs font-semibold text-zinc-300" : "text-xs text-zinc-400"}`}
				>
					{label}
				</label>
				{description && <span className="text-[10px] text-zinc-500 leading-normal">{description}</span>}
			</div>
		</div>
	);
}
