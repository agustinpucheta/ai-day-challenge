-- CreateTable
CREATE TABLE "tracked_issues" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "issue_key" TEXT NOT NULL,
    "jira_site_url" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracked_issues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tracked_issues_user_id_display_order_idx" ON "tracked_issues"("user_id", "display_order");

-- CreateIndex
CREATE UNIQUE INDEX "tracked_issues_user_id_jira_site_url_issue_key_key" ON "tracked_issues"("user_id", "jira_site_url", "issue_key");

-- AddForeignKey
ALTER TABLE "tracked_issues" ADD CONSTRAINT "tracked_issues_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
