using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FormBuilderAppService.Migrations
{
    /// <inheritdoc />
    public partial class AddAuditColumnsToUsersAndRoles : Migration
    {
        /// <summary>
        /// The value AddColumn backfills a non-nullable datetime2 with. Rows still
        /// holding it are the pre-existing ones that need a real value.
        /// </summary>
        private const string ClrDefaultDate = "0001-01-01T00:00:00";

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ---------------------------------------------------------- AspNetUsers

            // Scaffolding matched CreatedAtUtc to "Updated" purely on name similarity,
            // which would have moved every creation timestamp into the wrong column and
            // left Created sitting at year 1. CreatedAtUtc holds creation times, so it
            // becomes Created - renamed, not dropped and re-added, so the existing
            // values survive.
            migrationBuilder.RenameColumn(
                name: "CreatedAtUtc",
                table: "AspNetUsers",
                newName: "Created");

            migrationBuilder.AddColumn<DateTime>(
                name: "Updated",
                table: "AspNetUsers",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<string>(
                name: "CreatedBy",
                table: "AspNetUsers",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UpdatedBy",
                table: "AspNetUsers",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                table: "AspNetUsers",
                type: "bit",
                nullable: false,
                defaultValue: false);

            // Defaults to true, not the CLR default of false that scaffolding produced.
            // With false, this migration would deactivate every account that already
            // exists - including the admin needed to turn them back on.
            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "AspNetUsers",
                type: "bit",
                nullable: false,
                defaultValue: true);

            // ---------------------------------------------------------- AspNetRoles

            migrationBuilder.AddColumn<DateTime>(
                name: "Created",
                table: "AspNetRoles",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "Updated",
                table: "AspNetRoles",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<string>(
                name: "CreatedBy",
                table: "AspNetRoles",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UpdatedBy",
                table: "AspNetRoles",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                table: "AspNetRoles",
                type: "bit",
                nullable: false,
                defaultValue: false);

            // ---------------------------------------------------------- backfills

            // Rows that pre-date these columns have no update history, so Updated mirrors
            // Created - the same thing the application does when it inserts a new row.
            migrationBuilder.Sql($@"
                UPDATE [AspNetUsers]
                SET [Updated] = [Created],
                    [CreatedBy] = COALESCE([CreatedBy], 'System'),
                    [UpdatedBy] = COALESCE([UpdatedBy], 'System')
                WHERE [Updated] = '{ClrDefaultDate}';");

            // Roles have no timestamp to inherit, so they are stamped with "when tracking
            // started". SYSDATETIME() rather than SYSUTCDATETIME() because these columns
            // hold server local time.
            migrationBuilder.Sql($@"
                UPDATE [AspNetRoles]
                SET [Created] = SYSDATETIME(),
                    [Updated] = SYSDATETIME(),
                    [CreatedBy] = COALESCE([CreatedBy], 'System'),
                    [UpdatedBy] = COALESCE([UpdatedBy], 'System')
                WHERE [Created] = '{ClrDefaultDate}';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "Updated", table: "AspNetUsers");
            migrationBuilder.DropColumn(name: "CreatedBy", table: "AspNetUsers");
            migrationBuilder.DropColumn(name: "UpdatedBy", table: "AspNetUsers");
            migrationBuilder.DropColumn(name: "IsDeleted", table: "AspNetUsers");
            migrationBuilder.DropColumn(name: "IsActive", table: "AspNetUsers");

            migrationBuilder.DropColumn(name: "Created", table: "AspNetRoles");
            migrationBuilder.DropColumn(name: "Updated", table: "AspNetRoles");
            migrationBuilder.DropColumn(name: "CreatedBy", table: "AspNetRoles");
            migrationBuilder.DropColumn(name: "UpdatedBy", table: "AspNetRoles");
            migrationBuilder.DropColumn(name: "IsDeleted", table: "AspNetRoles");

            migrationBuilder.RenameColumn(
                name: "Created",
                table: "AspNetUsers",
                newName: "CreatedAtUtc");
        }
    }
}
