import { Elysia } from "elysia";
import { createSshKey, listSshKeys, getSshKeyById, deleteSshKey } from "../../db/repo/ssh-keys";
import { ok, fail } from "../response";

export const sshKeysRoutes = new Elysia()
  .get("/ssh-keys", async () => {
    return ok(await listSshKeys());
  })
  .post("/ssh-keys", async ({ body, set }: any) => {
    if (!body?.name || !body.privateKey) {
      set.status = 400;
      return fail("name and privateKey are required");
    }
    const created = await createSshKey({
      name: body.name,
      privateKey: body.privateKey,
      tags: body.tags,
    });
    set.status = 201;
    return ok(created);
  })
  .get("/ssh-keys/:id", async ({ params, set }: any) => {
    const key = await getSshKeyById(params.id);
    if (!key) { set.status = 404; return fail("Not found"); }
    return ok(key);
  })
  .delete("/ssh-keys/:id", async ({ params, set }: any) => {
    const deleted = await deleteSshKey(params.id);
    if (!deleted) { set.status = 404; return fail("Not found"); }
    return ok(null, "Deleted");
  });
