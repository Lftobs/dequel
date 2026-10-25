import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";
import { Layout } from "../components/Layout";
import { CreateDatabasePage } from "./CreateDatabasePage";
import { CreateProjectPage } from "./CreateProjectPage";
import { Dashboard } from "./Dashboard";
import { DatabaseDetail } from "./DatabaseDetail";
import { Databases } from "./Databases";
import { DeploymentDetailPage } from "./DeploymentDetailPage";
import { Keys } from "./Keys";
import { Login } from "./Login";
import { ProjectDetail } from "./ProjectDetail";
import { Settings } from "./Settings";
import { SharedEnv } from "./SharedEnv";
import { TemplatesPage } from "./TemplatesPage";

const rootRoute = createRootRoute({
	component: () => (
		<Layout>
			<Outlet />
		</Layout>
	),
});

const indexRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/",
	component: Dashboard,
});

const loginRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/login",
	component: Login,
});

const settingsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/settings",
	component: Settings,
});

const createProjectRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/projects/new",
	component: CreateProjectPage,
});

const templatesRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/templates",
	component: TemplatesPage,
});

const databasesRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/databases",
	component: Databases,
});

const createDatabaseRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/databases/new",
	component: CreateDatabasePage,
});

const DatabaseDetailPage = () => {
	const { databaseId } = databaseDetailRoute.useParams();
	return <DatabaseDetail databaseId={databaseId} />;
};

const databaseDetailRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/databases/$databaseId",
	component: DatabaseDetailPage,
});

const keysRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/keys",
	component: Keys,
});

const sharedEnvRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/shared-env",
	component: SharedEnv,
});

const ProjectPage = () => {
	const { projectId } = projectRoute.useParams();
	return <ProjectDetail projectId={projectId} />;
};

const projectRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/project/$projectId",
	component: ProjectPage,
	validateSearch: (search: Record<string, unknown>) => ({
		tab: (search.tab as string) || "deployments",
		section: typeof search.section === "string" ? search.section : undefined,
	}),
});

const ProjectDeploymentDetailPage = () => {
	const { projectId, deploymentId } = projectDeploymentDetailRoute.useParams();
	return <DeploymentDetailPage projectId={projectId} deploymentId={deploymentId} />;
};

const projectDeploymentDetailRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/project/$projectId/deployments/$deploymentId",
	component: ProjectDeploymentDetailPage,
});

const routeTree = rootRoute.addChildren([
	indexRoute,
	loginRoute,
	settingsRoute,
	databasesRoute,
	createDatabaseRoute,
	databaseDetailRoute,
	keysRoute,
	sharedEnvRoute,
	projectRoute,
	projectDeploymentDetailRoute,
	createProjectRoute,
	templatesRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}
