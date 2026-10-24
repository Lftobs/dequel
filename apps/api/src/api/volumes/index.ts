import { Elysia } from "elysia";
import { createVolume, deleteVolume, getVolumeById, listVolumes } from "../../db/repo";
import { isComposeStackVolume } from "../../db/repo/volumes";
import { created, fail, ok } from "../response";

export const volumesRoutes = new Elysia()
	.get("/projects/:id/volumes", async ({ params }) =>
		ok(
			(await listVolumes(params.id)).map((v) => ({
				...v,
				managed: isComposeStackVolume(v.dockerVolumeName, params.id),
			})),
		),
	)
	.post("/projects/:id/volumes", async ({ params, body }: any) =>
		created(
			await createVolume({
				projectId: params.id,
				mountPath: body?.mountPath,
			}),
		),
	)
	.get("/volumes/:id", async ({ params: { id }, set }) => {
		const volume = await getVolumeById(id);
		if (!volume) {
			set.status = 404;
			return fail("Volume not found");
		}
		return ok(volume);
	})
	.delete("/volumes/:id", async ({ params: { id }, set }) => {
		const volume = await getVolumeById(id);
		if (!volume) {
			set.status = 404;
			return fail("Volume not found");
		}
		if (isComposeStackVolume(volume.dockerVolumeName, volume.projectId)) {
			set.status = 400;
			return fail("This volume belongs to the project's Docker Compose stack - edit the compose file to change it");
		}
		const deleted = await deleteVolume(id);
		if (!deleted) {
			set.status = 404;
			return fail("Volume not found");
		}
		return ok(null, "Volume deleted");
	});
