-- Múltiplos empregos: cada escala (schedule_periods), troca (shift_swaps) e hora extra (extra_hours)
-- passa a pertencer a um emprego (jobs). Usuários que já têm dados recebem um emprego padrão
-- ("Trabalho principal", azul) e todos os registros existentes são vinculados a ele. Nada é apagado.
--
-- Escrito à mão (não é a saída crua do drizzle-kit): o SQL gerado adicionaria "job_id" NOT NULL
-- direto, o que falha em tabelas com dados. Tudo fica num único bloco DO, que o Postgres executa de
-- forma atômica — o migrator do neon-http roda cada statement sem transação, então isso evita deixar
-- o banco meio migrado se algo falhar. Os nomes das constraints batem com drizzle/meta/0001_snapshot.json.
DO $$
BEGIN
	CREATE TABLE "jobs" (
		"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
		"user_id" uuid NOT NULL,
		"name" text NOT NULL,
		"color" text DEFAULT '#0a84ff' NOT NULL,
		"created_at" timestamp with time zone DEFAULT now() NOT NULL
	);
	ALTER TABLE "jobs" ADD CONSTRAINT "jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

	ALTER TABLE "schedule_periods" ADD COLUMN "job_id" uuid;
	ALTER TABLE "shift_swaps" ADD COLUMN "job_id" uuid;
	ALTER TABLE "extra_hours" ADD COLUMN "job_id" uuid;

	-- Um emprego padrão por usuário que já tem qualquer dado de escala, troca ou hora extra.
	INSERT INTO "jobs" ("user_id", "name", "color")
	SELECT u."id", 'Trabalho principal', '#0a84ff'
	FROM "users" u
	WHERE EXISTS (SELECT 1 FROM "schedule_periods" p WHERE p."user_id" = u."id")
	   OR EXISTS (SELECT 1 FROM "shift_swaps" s WHERE s."user_id" = u."id")
	   OR EXISTS (SELECT 1 FROM "extra_hours" e WHERE e."user_id" = u."id");

	-- Neste ponto cada usuário tem no máximo um emprego, então o vínculo é inequívoco.
	UPDATE "schedule_periods" p SET "job_id" = j."id" FROM "jobs" j WHERE j."user_id" = p."user_id";
	UPDATE "shift_swaps" s SET "job_id" = j."id" FROM "jobs" j WHERE j."user_id" = s."user_id";
	UPDATE "extra_hours" e SET "job_id" = j."id" FROM "jobs" j WHERE j."user_id" = e."user_id";

	ALTER TABLE "schedule_periods" ALTER COLUMN "job_id" SET NOT NULL;
	ALTER TABLE "shift_swaps" ALTER COLUMN "job_id" SET NOT NULL;
	ALTER TABLE "extra_hours" ALTER COLUMN "job_id" SET NOT NULL;
	ALTER TABLE "schedule_periods" ADD CONSTRAINT "schedule_periods_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;
	ALTER TABLE "shift_swaps" ADD CONSTRAINT "shift_swaps_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;
	ALTER TABLE "extra_hours" ADD CONSTRAINT "extra_hours_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;
END $$;
