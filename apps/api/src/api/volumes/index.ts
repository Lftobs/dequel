import { Elysia } from "elysia";
import {
	createVolume,
	deleteVolume,
	getVolumeById,
	listVolumes,
} from "../../db/repo";

export const volumesRoutes = new Elysia()
	.get(
		"/projects/:id/volumes",
		async ({ params }) => listVolumes(params.id),
	)
	.post(
		"/projects/:id/volumes",
		async ({ params, body }: any) =>
			createVolume({
				projectId: params.id,
				mountPath: body?.mountPath,
			}),
	)
	.get(
		"/volumes/:id",
		async ({ params: { id }, set }) => {
			const volume = await getVolumeById(id);
			if (!volume) {
				set.status = 404;
				return { error: "Volume not found" };
			}
			return volume;
		},
	)
	.delete(
		"/volumes/:id",
		async ({ params: { id }, set }) => {
			const ok = await deleteVolume(id);
			if (!ok) {
				set.status = 404;
				return { error: "Volume not found" };
			}
			return { ok: true };
		},
	);
