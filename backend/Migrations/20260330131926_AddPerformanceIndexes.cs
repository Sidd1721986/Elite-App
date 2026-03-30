using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EliteApp.API.Migrations
{
    /// <inheritdoc />
    public partial class AddPerformanceIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Messages_ReceiverId",
                table: "Messages");

            migrationBuilder.DropIndex(
                name: "IX_Messages_SenderId",
                table: "Messages");

            migrationBuilder.DropIndex(
                name: "IX_Jobs_CustomerId",
                table: "Jobs");

            migrationBuilder.DropIndex(
                name: "IX_Jobs_VendorId",
                table: "Jobs");

            migrationBuilder.CreateIndex(
                name: "IX_Messages_ReceiverId_IsRead_Timestamp",
                table: "Messages",
                columns: new[] { "ReceiverId", "IsRead", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_Messages_SenderId_ReceiverId_Timestamp",
                table: "Messages",
                columns: new[] { "SenderId", "ReceiverId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_Jobs_CustomerId_CreatedAt",
                table: "Jobs",
                columns: new[] { "CustomerId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Jobs_Status_AssignedAt",
                table: "Jobs",
                columns: new[] { "Status", "AssignedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Jobs_VendorId_CreatedAt",
                table: "Jobs",
                columns: new[] { "VendorId", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Messages_ReceiverId_IsRead_Timestamp",
                table: "Messages");

            migrationBuilder.DropIndex(
                name: "IX_Messages_SenderId_ReceiverId_Timestamp",
                table: "Messages");

            migrationBuilder.DropIndex(
                name: "IX_Jobs_CustomerId_CreatedAt",
                table: "Jobs");

            migrationBuilder.DropIndex(
                name: "IX_Jobs_Status_AssignedAt",
                table: "Jobs");

            migrationBuilder.DropIndex(
                name: "IX_Jobs_VendorId_CreatedAt",
                table: "Jobs");

            migrationBuilder.CreateIndex(
                name: "IX_Messages_ReceiverId",
                table: "Messages",
                column: "ReceiverId");

            migrationBuilder.CreateIndex(
                name: "IX_Messages_SenderId",
                table: "Messages",
                column: "SenderId");

            migrationBuilder.CreateIndex(
                name: "IX_Jobs_CustomerId",
                table: "Jobs",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_Jobs_VendorId",
                table: "Jobs",
                column: "VendorId");
        }
    }
}
