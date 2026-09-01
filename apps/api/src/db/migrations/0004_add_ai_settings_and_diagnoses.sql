CREATE TABLE IF NOT EXISTS "ai_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"default_provider" text DEFAULT 'openai' NOT NULL,
	"openai_api_key_encrypted" text,
	"openai_api_key_iv" text,
	"openai_api_key_tag" text,
	"openai_model" text DEFAULT 'gpt-4o-mini' NOT NULL,
	"gemini_api_key_encrypted" text,
	"gemini_api_key_iv" text,
	"gemini_api_key_tag" text,
	"gemini_model" text DEFAULT 'gemini-2.0-flash' NOT NULL,
	"grok_api_key_encrypted" text,
	"grok_api_key_iv" text,
	"grok_api_key_tag" text,
	"grok_model" text DEFAULT 'grok-2-latest' NOT NULL,
	"claude_api_key_encrypted" text,
	"claude_api_key_iv" text,
	"claude_api_key_tag" text,
	"claude_model" text DEFAULT 'claude-3-5-sonnet-20241022' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ai_diagnoses" (
	"id" text PRIMARY KEY NOT NULL,
	"deployment_id" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"summary" text NOT NULL,
	"root_cause" text NOT NULL,
	"explanation" text NOT NULL,
	"suggested_fixes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"raw_response" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_diagnoses_deployment_id_deployments_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployments"("id") ON DELETE cascade ON UPDATE no action
);

CREATE INDEX IF NOT EXISTS "idx_ai_diagnoses_deployment" ON "ai_diagnoses" ("deployment_id");
