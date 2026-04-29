using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EliteApp.API.Migrations
{
    /// <inheritdoc />
    public partial class AdminInviteFlow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AdminInvites",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Email = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    TokenHash = table.Column<string>(type: "text", nullable: false),
                    InvitedByAdminId = table.Column<Guid>(type: "uuid", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Used = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AdminInvites", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AdminInvites_Users_InvitedByAdminId",
                        column: x => x.InvitedByAdminId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AdminInvites_Email",
                table: "AdminInvites",
                column: "Email");

            migrationBuilder.CreateIndex(
                name: "IX_AdminInvites_InvitedByAdminId",
                table: "AdminInvites",
                column: "InvitedByAdminId");

            migrationBuilder.CreateIndex(
                name: "IX_AdminInvites_TokenHash",
                table: "AdminInvites",
                column: "TokenHash",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AdminInvites");
        }
    }
}
