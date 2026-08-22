using FormBuilderAppService.Models.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace FormBuilderAppService.Data
{
    /// <summary>
    /// EF Core context for the ASP.NET Core Identity tables only (AspNetUsers,
    /// AspNetRoles, AspNetUserRoles, AspNetUserClaims, AspNetRoleClaims,
    /// AspNetUserLogins, AspNetUserTokens).
    ///
    /// It shares the "PracticeDB" SQL Server database with Tenants, but nothing else in
    /// the application goes through EF: Tenants stay on Dapper + stored procedures and
    /// Forms/FormSubmissions/Resources stay in MongoDB. No existing table is mapped here,
    /// so migrations generated from this context can never alter them.
    /// </summary>
    public class AppIdentityDbContext
        : IdentityDbContext<ApplicationUser, ApplicationRole, Guid>
    {
        public AppIdentityDbContext(DbContextOptions<AppIdentityDbContext> options)
            : base(options)
        {
        }

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);

            //
            // Created/Updated carry a SYSDATETIME() default so a row can be INSERTed by
            // hand - a SQL script adding a role, for instance - without naming them.
            // The columns are NOT NULL, so without a default such a script fails.
            //
            // Declared on the model rather than as raw SQL in a migration on purpose: a
            // default that exists only in a migration is invisible to the snapshot, and
            // the next AlterColumn silently drops it. That is exactly how these
            // constraints were lost before.
            //
            // This does not change what the application writes. EF only falls back to
            // the database default when the property still holds default(DateTime), and
            // both properties are initialised to DateTime.Now, so EF always sends its
            // own value. SYSDATETIME() (local, like DateTime.Now) rather than
            // SYSUTCDATETIME() keeps hand-inserted rows consistent with the rest.
            builder.Entity<ApplicationUser>(entity =>
            {
                entity.Property(u => u.FirstName).HasMaxLength(100);
                entity.Property(u => u.LastName).HasMaxLength(100);
                entity.Property(u => u.FullName).HasMaxLength(200);
                entity.Property(u => u.CreatedBy).HasMaxLength(200);
                entity.Property(u => u.UpdatedBy).HasMaxLength(200);
                entity.Property(u => u.Created).HasDefaultValueSql("SYSDATETIME()");
                entity.Property(u => u.Updated).HasDefaultValueSql("SYSDATETIME()");
            });

            builder.Entity<ApplicationRole>(entity =>
            {
                entity.Property(r => r.Description).HasMaxLength(500);
                entity.Property(r => r.CreatedBy).HasMaxLength(200);
                entity.Property(r => r.UpdatedBy).HasMaxLength(200);
                entity.Property(r => r.Created).HasDefaultValueSql("SYSDATETIME()");
                entity.Property(r => r.Updated).HasDefaultValueSql("SYSDATETIME()");
            });
        }
    }
}
