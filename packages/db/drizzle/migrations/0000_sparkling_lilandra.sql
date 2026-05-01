CREATE TABLE "agent_executions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"execution_id" uuid NOT NULL,
	"agent_id" text NOT NULL,
	"role" text NOT NULL,
	"status" text NOT NULL,
	"output" jsonb,
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	CONSTRAINT "agent_executions_role_check" CHECK ("agent_executions"."role" IN ('investigation', 'integration')),
	CONSTRAINT "agent_executions_status_check" CHECK ("agent_executions"."status" IN ('pending', 'running', 'completed', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "executions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"template_id" uuid NOT NULL,
	"parameters" jsonb NOT NULL,
	"status" text NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	CONSTRAINT "executions_status_check" CHECK ("executions"."status" IN ('pending', 'running', 'completed', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "results" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"execution_id" uuid NOT NULL,
	"markdown" text NOT NULL,
	"structured" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"definition" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_executions" ADD CONSTRAINT "agent_executions_execution_id_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."executions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "executions" ADD CONSTRAINT "executions_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "results" ADD CONSTRAINT "results_execution_id_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."executions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_executions_execution_agent_unique" ON "agent_executions" USING btree ("execution_id","agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "results_execution_unique" ON "results" USING btree ("execution_id");