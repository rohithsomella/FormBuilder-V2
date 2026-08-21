using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FormBuilderAppService.Migrations
{
    /// <inheritdoc />
    public partial class AddUserProfileFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAtUtc",
                table: "AspNetUsers",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<string>(
                name: "FirstName",
                table: "AspNetUsers",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LastName",
                table: "AspNetUsers",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            // AddColumn backfills existing rows with the CLR default, 0001-01-01. Those
            // accounts pre-date this column, so their real creation date is not
            // recoverable - but leaving them in year 1 would put them at the far end of
            // the User Details table's date sort and render as a nonsense date. Stamping
            // them with "when tracking started" is the honest approximation.
            migrationBuilder.Sql(@"
                UPDATE [AspNetUsers]
                SET [CreatedAtUtc] = SYSUTCDATETIME()
                WHERE [CreatedAtUtc] = '0001-01-01T00:00:00';");

            // Same reasoning for the name columns: the seeded accounts only ever had
            // FullName, so split it rather than showing blank First/Last name cells.
            migrationBuilder.Sql(@"
                UPDATE [AspNetUsers]
                SET [FirstName] = LEFT([FullName], CHARINDEX(' ', [FullName] + ' ') - 1),
                    [LastName]  = LTRIM(SUBSTRING([FullName], CHARINDEX(' ', [FullName] + ' '), LEN([FullName])))
                WHERE [FullName] IS NOT NULL
                  AND LTRIM(RTRIM([FullName])) <> ''
                  AND [FirstName] IS NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CreatedAtUtc",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "FirstName",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "LastName",
                table: "AspNetUsers");
        }
    }
}
