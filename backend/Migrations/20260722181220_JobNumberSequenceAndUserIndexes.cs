using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EliteApp.API.Migrations
{
    /// <inheritdoc />
    public partial class JobNumberSequenceAndUserIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Parent job numbers move from "advisory lock + MAX(JobNumber)+1" (which serialized
            // every job creation) to an atomic Postgres sequence. Seed it past the current max
            // so numbering continues without collisions.
            migrationBuilder.Sql("""
                CREATE SEQUENCE IF NOT EXISTS job_number_seq;
                SELECT setval('job_number_seq',
                    GREATEST((SELECT COALESCE(MAX("JobNumber"), 1000) FROM "Jobs"), 1000));
                """);

            // Hot-path login indexes, previously created only by ad-hoc startup SQL in Program.cs —
            // they belong in migrations so environments that skip startup migrations still get them.
            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS ix_users_role_approved_active
                    ON "Users" ("Role", "IsApproved", "IsActive");
                CREATE INDEX IF NOT EXISTS ix_users_email_lower
                    ON "Users" (LOWER("Email"));
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP INDEX IF EXISTS ix_users_email_lower;
                DROP INDEX IF EXISTS ix_users_role_approved_active;
                DROP SEQUENCE IF EXISTS job_number_seq;
                """);
        }
    }
}
