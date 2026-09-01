import { Elysia } from "elysia";
import { getDeploymentById, getLatestAiDiagnosis } from "../../db/repo";
import { diagnoseDeploymentFailure } from "../../ai";
import { ok, fail } from "../response";

export const deploymentAiRoutes = new Elysia()
  .post(
    "/deployments/:id/ai-diagnose",
    async ({ params: { id }, body, set }: any) => {
      const deployment = await getDeploymentById(id);
      if (!deployment) {
        set.status = 404;
        return fail("Deployment not found");
      }

      try {
        const result = await diagnoseDeploymentFailure({
          deploymentId: id,
          provider: body?.provider,
          model: body?.model,
          apiKey: body?.apiKey,
          customPrompt: body?.customPrompt,
        });
        return ok(result);
      } catch (err: any) {
        set.status = 400;
        return fail(err.message || "Failed to analyze build failure with AI");
      }
    },
  )
  .get(
    "/deployments/:id/ai-diagnosis",
    async ({ params: { id }, set }) => {
      const deployment = await getDeploymentById(id);
      if (!deployment) {
        set.status = 404;
        return fail("Deployment not found");
      }

      const diagnosis = await getLatestAiDiagnosis(id);
      return ok(diagnosis);
    },
  );
