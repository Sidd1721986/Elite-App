using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EliteApp.API.Migrations
{
    /// <inheritdoc />
    public partial class AddPasswordResetTokenLiveIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_PasswordResetTokens_Used_ExpiresAt",
                table: "PasswordResetTokens",
                columns: new[] { "Used", "ExpiresAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_PasswordResetTokens_Used_ExpiresAt",
                table: "PasswordResetTokens");
        }
    }
}
