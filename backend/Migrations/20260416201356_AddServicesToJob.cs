using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EliteApp.API.Migrations
{
    /// <inheritdoc />
    public partial class AddServicesToJob : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Services",
                table: "Jobs",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Services",
                table: "Jobs");
        }
    }
}
