using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EliteApp.API.Migrations
{
    /// <inheritdoc />
    public partial class AddPhoneNormalized : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PhoneNormalized",
                table: "Users",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            // Backfill existing rows — the phone-based password reset now matches on this column
            // alone, so an unpopulated row would stop resolving. Mirrors PhoneNormalizer.ForStorage:
            // digits only, last 10 when longer, NULL when nothing is left to match on.
            migrationBuilder.Sql(@"
                UPDATE ""Users""
                SET ""PhoneNormalized"" = NULLIF(RIGHT(REGEXP_REPLACE(""Phone"", '[^0-9]', '', 'g'), 10), '')
                WHERE ""Phone"" IS NOT NULL AND ""Phone"" <> '';");

            migrationBuilder.CreateIndex(
                name: "IX_Users_PhoneNormalized",
                table: "Users",
                column: "PhoneNormalized");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Users_PhoneNormalized",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "PhoneNormalized",
                table: "Users");
        }
    }
}
