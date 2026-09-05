import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";
import { Layout } from "../components/Layout";
import { CreateProjectPage } from "./CreateProjectPage";
import { Dashboard } from "./Dashboard";
import { Databases } from "./Databases";
import { Keys } from "./Keys";
import { Login } from "./Login";
import { ProjectDetail } from "./ProjectDetail";
import { Settings } from "./Settings";
import { SharedEnv } from "./SharedEnv";

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

const databasesRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/databases",
	component: Databases,
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
	}),
});

const routeTree = rootRoute.addChildren([
	indexRoute,
	loginRoute,
	settingsRoute,
	databasesRoute,
	keysRoute,
	sharedEnvRoute,
	projectRoute,
	createProjectRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}
