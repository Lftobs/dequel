import { useQuery } from "@tanstack/react-query";
import { Code2, Layers, ShieldAlert, Table as TableIcon } from "lucide-react";
import { useEffect, useState } from "react";
import * as api from "../../api/client";
import type { Database, QueryExecResult } from "../../types";
import { DataTableView } from "./studio/DataTableView";
import { SqlQueryView } from "./studio/SqlQueryView";
import { StructureView } from "./studio/StructureView";
import { TableSidebar } from "./studio/TableSidebar";

interface DatabaseStudioProps {
	database: Database;
}

export function DatabaseStudio({ database }: DatabaseStudioProps) {
	const [activeTab, setActiveTab] = useState<"data" | "structure" | "sql">("data");
	const [selectedTable, setSelectedTable] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [page, setPage] = useState(1);
	const pageSize = 10;

	const [selectedRows, setSelectedRows] = useState<number[]>([]);

	// Custom SQL Query state
	const [sqlQuery, setSqlQuery] = useState("SELECT * FROM information_schema.tables WHERE table_schema='public';");
	const [sqlResult, setSqlResult] = useState<QueryExecResult | null>(null);
	const [sqlError, setSqlError] = useState<string | null>(null);
	const [isExecutingSql, setIsExecutingSql] = useState(false);

	const [dataResult, setDataResult] = useState<QueryExecResult | null>(null);
	const [isLoadingData, setIsLoadingData] = useState(false);
	const [dataError, setDataError] = useState<string | null>(null);

	// Fetch Table List
	const {
		data: tables = [],
		refetch: refetchTables,
		isLoading: isLoadingTables,
	} = useQuery({
		queryKey: ["database-tables", database.id],
		queryFn: async () => {
			const res = await api.getDatabaseTables(database.id).catch(() => []);
			if (res.length > 0 && !selectedTable) {
				setSelectedTable(res[0].name);
			}
			return res;
		},
	});

	// Auto-select first table if available
	useEffect(() => {
		if (tables.length > 0 && !selectedTable) {
			setSelectedTable(tables[0].name);
		}
	}, [tables, selectedTable]);

	// Fetch Data for Selected Table
	const loadTableData = async () => {
		if (!selectedTable) return;
		setIsLoadingData(true);
		setDataError(null);
		setSelectedRows([]);

		const offset = (page - 1) * pageSize;
		let query = "";

		if (database.type === "postgresql") {
			query = `SELECT * FROM "${selectedTable}" LIMIT ${pageSize} OFFSET ${offset};`;
		} else if (database.type === "mysql") {
			query = `SELECT * FROM \`${selectedTable}\` LIMIT ${pageSize} OFFSET ${offset};`;
		} else if (database.type === "mongodb") {
			query = `db.${selectedTable}.find().skip(${offset}).limit(${pageSize})`;
		} else {
			query = `KEYS *`;
		}

		try {
			const res = await api.queryDatabase(database.id, query);
			setDataResult(res);
		} catch (err: any) {
			setDataError(err.message || "Failed to load table records");
			setDataResult(null);
		} finally {
			setIsLoadingData(false);
		}
	};

	useEffect(() => {
		if (selectedTable && activeTab === "data") {
			loadTableData();
		}
	}, [selectedTable, page, activeTab]);

	const handleExecuteSql = async () => {
		if (!sqlQuery.trim()) return;
		setIsExecutingSql(true);
		setSqlError(null);
		try {
			const res = await api.queryDatabase(database.id, sqlQuery);
			setSqlResult(res);
		} catch (err: any) {
			setSqlError(err.message || "Query execution failed");
			setSqlResult(null);
		} finally {
			setIsExecutingSql(false);
		}
	};

	const handleSaveInlineEdit = async (rowIndex: number, editedValues: Record<string, string>) => {
		if (!selectedTable || !dataResult) return;
		const primaryKeyCol = dataResult.columns[0] || "id";
		const originalRow = dataResult.rows[rowIndex];
		const primaryKeyVal = originalRow[primaryKeyCol];

		const setAssignments = dataResult.columns
			.map((col) => {
				const val = editedValues[col];
				if (val === undefined || val === "" || val.toUpperCase() === "NULL") return `"${col}" = NULL`;
				if (!isNaN(Number(val)) && val.trim() !== "") return `"${col}" = ${val}`;
				if (val.toLowerCase() === "true" || val.toLowerCase() === "false") return `"${col}" = ${val}`;
				return `"${col}" = '${val.replace(/'/g, "''")}'`;
			})
			.join(", ");

		const updateQuery = `UPDATE "${selectedTable}" SET ${setAssignments} WHERE "${primaryKeyCol}" = '${primaryKeyVal}';`;

		try {
			await api.queryDatabase(database.id, updateQuery);
			loadTableData();
		} catch (err: any) {
			setDataError(`Save failed: ${err.message}`);
		}
	};

	const handleSaveInlineAdd = async (newValues: Record<string, string>) => {
		if (!selectedTable || !dataResult) return;
		const cols = dataResult.columns.filter((c) => newValues[c] !== undefined && newValues[c].trim() !== "");
		if (cols.length === 0) return;

		const colNames = cols.map((c) => `"${c}"`).join(", ");
		const values = cols.map((c) => `'${newValues[c].replace(/'/g, "''")}'`).join(", ");
		const insertQuery = `INSERT INTO "${selectedTable}" (${colNames}) VALUES (${values});`;

		try {
			await api.queryDatabase(database.id, insertQuery);
			loadTableData();
		} catch (err: any) {
			setDataError(`Insert failed: ${err.message}`);
		}
	};

	const handleDeleteSelected = async () => {
		if (!selectedTable || !dataResult || selectedRows.length === 0) return;
		const primaryKeyCol = dataResult.columns[0] || "id";
		const pks = selectedRows.map((idx) => dataResult.rows[idx][primaryKeyCol]);
		const formattedPks = pks.map((pk) => `'${String(pk).replace(/'/g, "''")}'`).join(", ");

		const deleteQuery = `DELETE FROM "${selectedTable}" WHERE "${primaryKeyCol}" IN (${formattedPks});`;

		try {
			await api.queryDatabase(database.id, deleteQuery);
			setSelectedRows([]);
			loadTableData();
		} catch (err: any) {
			setDataError(`Delete failed: ${err.message}`);
		}
	};

	return (
		<div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
			{/* Left Sidebar Schema Navigator */}
			<TableSidebar
				tables={tables}
				selectedTable={selectedTable}
				onSelectTable={(t) => {
					setSelectedTable(t);
					setPage(1);
				}}
				onRefresh={refetchTables}
				isLoading={isLoadingTables}
				searchQuery={searchQuery}
				onSearchChange={setSearchQuery}
			/>

			{/* Main Data Studio Canvas */}
			<div className="lg:col-span-3 space-y-4">
				{/* Top Mode Switcher Bar */}
				<div className="border border-border/60 bg-card/60 rounded-3xl p-3 flex items-center justify-between backdrop-blur-md shadow-xl">
					<div className="flex items-center gap-1 bg-black/50 p-1 rounded-full border border-border/40">
						<button
							type="button"
							onClick={() => setActiveTab("data")}
							className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all flex items-center gap-1.5 ${
								activeTab === "data"
									? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/20"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							<TableIcon className="h-3.5 w-3.5" /> DATA
						</button>
						<button
							type="button"
							onClick={() => setActiveTab("structure")}
							className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all flex items-center gap-1.5 ${
								activeTab === "structure"
									? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/20"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							<Layers className="h-3.5 w-3.5" /> STRUCTURE
						</button>
						<button
							type="button"
							onClick={() => setActiveTab("sql")}
							className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all flex items-center gap-1.5 ${
								activeTab === "sql"
									? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/20"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							<Code2 className="h-3.5 w-3.5" /> SQL QUERY
						</button>
					</div>

					<div className="text-xs text-muted-foreground font-mono px-3">
						Table: <span className="font-bold text-foreground">{selectedTable || "None"}</span>
					</div>
				</div>

				{dataError && (
					<div className="p-4 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs flex items-center gap-2">
						<ShieldAlert className="h-4 w-4 shrink-0" />
						<span>{dataError}</span>
					</div>
				)}

				{activeTab === "data" && (
					<DataTableView
						selectedTable={selectedTable}
						dataResult={dataResult}
						isLoadingData={isLoadingData}
						page={page}
						pageSize={pageSize}
						onPageChange={setPage}
						selectedRows={selectedRows}
						onSelectRow={(idx, checked) =>
							setSelectedRows(checked ? [...selectedRows, idx] : selectedRows.filter((i) => i !== idx))
						}
						onSelectAllRows={(checked) =>
							setSelectedRows(checked && dataResult ? dataResult.rows.map((_, i) => i) : [])
						}
						onSaveInlineEdit={handleSaveInlineEdit}
						onSaveInlineAdd={handleSaveInlineAdd}
						onDeleteSelected={handleDeleteSelected}
					/>
				)}

				{activeTab === "structure" && <StructureView selectedTable={selectedTable} dataResult={dataResult} />}

				{activeTab === "sql" && (
					<SqlQueryView
						sqlQuery={sqlQuery}
						onQueryChange={setSqlQuery}
						onExecute={handleExecuteSql}
						isExecuting={isExecutingSql}
						sqlResult={sqlResult}
						sqlError={sqlError}
					/>
				)}
			</div>
		</div>
	);
}
