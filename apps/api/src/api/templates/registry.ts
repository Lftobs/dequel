import { giteaTemplate } from "./templates/gitea";
import { itToolsTemplate } from "./templates/it-tools";
import { memosTemplate } from "./templates/memos";
import { n8nTemplate } from "./templates/n8n";
import { nextcloudTemplate } from "./templates/nextcloud";
import { paperlessNgxTemplate } from "./templates/paperless-ngx";
import { plausibleTemplate } from "./templates/plausible";
import { umamiTemplate } from "./templates/umami";
import { uptimeKumaTemplate } from "./templates/uptime-kuma";
import { vaultwardenTemplate } from "./templates/vaultwarden";
import { wordPressTemplate } from "./templates/wordpress";
import type { DeployTemplate } from "./types";

export type { DeployTemplate, RenderedTemplate, TemplateVar } from "./types";
export { renderCompose } from "./types";

const templates: DeployTemplate[] = [
	n8nTemplate,
	wordPressTemplate,
	uptimeKumaTemplate,
	giteaTemplate,
	nextcloudTemplate,
	paperlessNgxTemplate,
	plausibleTemplate,
	umamiTemplate,
	vaultwardenTemplate,
	memosTemplate,
	itToolsTemplate,
];

export const listTemplates = (): DeployTemplate[] => templates;

export const getTemplate = (key: string): DeployTemplate | undefined =>
	templates.find((t) => t.key.toLowerCase() === key.toLowerCase());
