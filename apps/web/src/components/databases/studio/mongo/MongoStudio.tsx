import { useQuery } from "@tanstack/react-query";
import { Boxes, FileText, Layers, ShieldAlert, Terminal } from "lucide-react";
import { useEffect, useState } from "react";
import * as api from "../../../../api/client";
import type { Database, QueryExecResult } from "../../../../types";
import { MongoCollectionSidebar } from "./MongoCollectionSidebar";
import { MongoDocumentsView } from "./MongoDocumentsView";
import { MongoIndexesView } from "./MongoIndexesView";
import { MongoShellView } from "./MongoShellView";

interface MongoStudioProps {
	database: Database;
}

export function MongoStudio({ database }: MongoStudioProps) {
	const [activeTab, setActiveTab] = useState<"documents" | "indexes" | "shell">("documents");
	const [selectedCollection, setSelectedCollection] = useState<string | null>(null);

	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(10);
	const [filterJson, setFilterJson] = useState("");
	const [sortJson, setSortJson] = useState('{ "_id": -1 }');

	const [dataResult, setDataResult] = useState<QueryExecResult | null>(null);
	const [isLoadingData, setIsLoadingData] = useState(false);
	const [dataError, setDataError] = useState<string | null>(null);

	// Mongo Shell state
	const [shellQuery, setShellQuery] = useState("");
	const [shellResult, setShellResult] = useState<QueryExecResult | null>(null);
	const [shellError, setShellError] = useState<string | null>(null);
	const [isExecutingShell, setIsExecutingShell] = useState(false);

	const {
		data: collections = [],
		refetch: refetchCollections,
		isLoading: isLoadingCollections,
	} = useQuery({
		queryKey: ["mongo-collections", database.id],
		queryFn: async () => {
			const res = await api.getDatabaseTables(database.id).catch(() => []);
			if (res.length > 0 && !selectedCollection) {
				setSelectedCollection(res[0].name);
			}
			return res;
		},
	});

	useEffect(() => {
		if (collections.length > 0 && !selectedCollection) {
			setSelectedCollection(collections[0].name);
		}
	}, [collections, selectedCollection]);

	useEffect(() => {
		if (selectedCollection) {
			setShellQuery(`db.${selectedCollection}.find().limit(20)`);
		}
	}, [selectedCollection]);

	const loadCollectionDocuments = async () => {
		if (!selectedCollection) return;
		setIsLoadingData(true);
		setDataError(null);

		const offset = (page - 1) * pageSize;
		const filter = filterJson.trim() || "{}";
		const sort = sortJson.trim();

		let q = `db.${selectedCollection}.find(${filter})`;
		if (sort) {
			q += `.sort(${sort})`;
		}
		q += `.skip(${offset}).limit(${pageSize})`;

		try {
			const res = await api.queryDatabase(database.id, q);
			setDataResult(res);
		} catch (err: any) {
			setDataError(err.message || "Failed to load documents");
			setDataResult(null);
		} finally {
			setIsLoadingData(false);
		}
	};

	useEffect(() => {
		if (selectedCollection && activeTab === "documents") {
			loadCollectionDocuments();
		}
	}, [selectedCollection, page, pageSize, activeTab]);

	const handleExecuteShell = async () => {
		if (!shellQuery.trim()) return;
		setIsExecutingShell(true);
		setShellError(null);
		try {
			const res = await api.queryDatabase(database.id, shellQuery);
			setShellResult(res);
		} catch (err: any) {
			setShellError(err.message || "Execution failed");
			setShellResult(null);
		} finally {
			setIsExecutingShell(false);
		}
	};

	const handleInsertDocument = async (doc: Record<string, unknown>) => {
		if (!selectedCollection) return;
		const query = `db.${selectedCollection}.insertOne(${JSON.stringify(doc)})`;
		await api.queryDatabase(database.id, query);
		await refetchCollections();
		loadCollectionDocuments();
	};

	const handleUpdateDocument = async (doc: Record<string, unknown>) => {
		if (!selectedCollection) return;
		const id = doc._id ?? doc.id;
		const cleanDoc = { ...doc };
		delete cleanDoc._id;

		const idCondition = typeof id === "string" && id.length === 24 ? `ObjectId("${id}")` : JSON.stringify(id);

		const query = `db.${selectedCollection}.replaceOne({ _id: ${idCondition} }, ${JSON.stringify(cleanDoc)})`;
		await api.queryDatabase(database.id, query);
		loadCollectionDocuments();
	};

	const handleDeleteDocument = async (id: string) => {
		if (!selectedCollection) return;
		const idCondition = id.length === 24 ? `ObjectId("${id}")` : JSON.stringify(id);

		const query = `db.${selectedCollection}.deleteOne({ _id: ${idCondition} })`;
		await api.queryDatabase(database.id, query);
		await refetchCollections();
		loadCollectionDocuments();
	};

	const handleCreateCollection = async (name: string) => {
		await api.queryDatabase(database.id, `db.createCollection("${name}")`);
		await refetchCollections();
		setSelectedCollection(name);
	};

	return (
		<div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
			<MongoCollectionSidebar
				collections={collections}
				selectedCollection={selectedCollection}
				onSelectCollection={(name) => {
					setSelectedCollection(name);
					setPage(1);
				}}
				onRefresh={refetchCollections}
				onCreateCollection={handleCreateCollection}
				isLoading={isLoadingCollections}
				databaseName={database.databaseName}
			/>

			<div className="lg:col-span-3 space-y-4">
				{/* Top Mode Switcher */}
				<div className="border border-border/60 bg-card/60 rounded-3xl p-3 flex items-center justify-between backdrop-blur-md shadow-xl">
					<div className="flex items-center gap-1 bg-black/50 p-1 rounded-full border border-border/40">
						<button
							type="button"
							onClick={() => setActiveTab("documents")}
							className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all flex items-center gap-1.5 ${
								activeTab === "documents"
									? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/20"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							<FileText className="h-3.5 w-3.5" /> DOCUMENTS
						</button>
						<button
							type="button"
							onClick={() => setActiveTab("indexes")}
							className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all flex items-center gap-1.5 ${
								activeTab === "indexes"
									? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/20"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							<Layers className="h-3.5 w-3.5" /> INDEXES &amp; STATS
						</button>
						<button
							type="button"
							onClick={() => setActiveTab("shell")}
							className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all flex items-center gap-1.5 ${
								activeTab === "shell"
									? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/20"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							<Terminal className="h-3.5 w-3.5" /> MONGO SHELL
						</button>
					</div>

					<div className="text-xs text-muted-foreground font-mono px-3">
						Collection: <span className="font-bold text-foreground">{selectedCollection || "None"}</span>
					</div>
				</div>

				{dataError && (
					<div className="p-4 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs flex items-center gap-2">
						<ShieldAlert className="h-4 w-4 shrink-0" />
						<span>{dataError}</span>
					</div>
				)}

				{activeTab === "documents" && (
					<MongoDocumentsView
						selectedCollection={selectedCollection}
						dataResult={dataResult}
						isLoading={isLoadingData}
						page={page}
						pageSize={pageSize}
						onPageChange={setPage}
						onPageSizeChange={setPageSize}
						filterJson={filterJson}
						onFilterChange={setFilterJson}
						sortJson={sortJson}
						onSortChange={setSortJson}
						onApplyFilter={() => {
							setPage(1);
							loadCollectionDocuments();
						}}
						onInsertDocument={handleInsertDocument}
						onUpdateDocument={handleUpdateDocument}
						onDeleteDocument={handleDeleteDocument}
					/>
				)}

				{activeTab === "indexes" && <MongoIndexesView database={database} selectedCollection={selectedCollection} />}

				{activeTab === "shell" && (
					<MongoShellView
						selectedCollection={selectedCollection}
						queryText={shellQuery}
						onQueryChange={setShellQuery}
						onExecute={handleExecuteShell}
						isExecuting={isExecutingShell}
						result={shellResult}
						error={shellError}
					/>
				)}
			</div>
		</div>
	);
}
