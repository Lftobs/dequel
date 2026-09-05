import { Elysia } from "elysia";
import {
  createSharedEnvVar, listSharedEnvVars, getSharedEnvVarById,
  getSharedEnvVarPlaintext, updateSharedEnvVar, deleteSharedEnvVar,
  linkSharedEnvVarsToProject, unlinkSharedEnvVarFromProject, listLinkedSharedEnvVars,
} from "../../db/repo/shared-env-vars";
import { ok, fail } from "../response";

export const sharedEnvVarsRoutes = new Elysia()
  .get("/shared-env-vars", async ({ query }: any) => {
    return ok(await listSharedEnvVars(query.environment));
  })
  .post("/shared-env-vars", async ({ body, set }: any) => {
    if (!body?.key || body.value === undefined) {
      set.status = 400;
      return fail("key and value are required");
    }
    const created = await createSharedEnvVar({
      key: body.key,
      value: body.value,
      environment: body.environment,
      description: body.description,
      tags: body.tags,
    });
    set.status = 201;
    return ok(created);
  })
  .get("/shared-env-vars/:id", async ({ params, set }: any) => {
    const item = await getSharedEnvVarById(params.id);
    if (!item) { set.status = 404; return fail("Not found"); }
    return ok(item);
  })
  .patch("/shared-env-vars/:id", async ({ params, body, set }: any) => {
    if (body.value === undefined) { set.status = 400; return fail("value is required"); }
    const updated = await updateSharedEnvVar(params.id, body.value);
    if (!updated) { set.status = 404; return fail("Not found"); }
    return ok(updated);
  })
  .get("/shared-env-vars/:id/reveal", async ({ params, set }: any) => {
    const val = await getSharedEnvVarPlaintext(params.id);
    if (!val) { set.status = 404; return fail("Not found"); }
    return ok({ value: val });
  })
  .delete("/shared-env-vars/:id", async ({ params, set }: any) => {
    const deleted = await deleteSharedEnvVar(params.id);
    if (!deleted) { set.status = 404; return fail("Not found"); }
    return ok(null, "Deleted");
  });

export const sharedEnvLinksRoutes = new Elysia()
  .get("/projects/:id/shared-env-links", async ({ params }: any) => {
    return ok(await listLinkedSharedEnvVars(params.id));
  })
  .post("/projects/:id/shared-env-links", async ({ params, body, set }: any) => {
    if (!Array.isArray(body?.sharedEnvVarIds)) {
      set.status = 400;
      return fail("sharedEnvVarIds array required");
    }
    await linkSharedEnvVarsToProject(params.id, body.sharedEnvVarIds);
    return ok(null, "Linked");
  })
  .delete("/projects/:id/shared-env-links/:linkId", async ({ params, set }: any) => {
    const removed = await unlinkSharedEnvVarFromProject(params.id, params.linkId);
    if (!removed) { set.status = 404; return fail("Link not found"); }
    return ok(null, "Unlinked");
  });
