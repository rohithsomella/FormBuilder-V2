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

            builder.Entity<ApplicationUser>(entity =>
            {
                entity.Property(u => u.FirstName).HasMaxLength(100);
                entity.Property(u => u.LastName).HasMaxLength(100);
                entity.Property(u => u.FullName).HasMaxLength(200);
                entity.Property(u => u.CreatedBy).HasMaxLength(200);
                entity.Property(u => u.UpdatedBy).HasMaxLength(200);
            });

            builder.Entity<ApplicationRole>(entity =>
            {
                entity.Property(r => r.Description).HasMaxLength(500);
                entity.Property(r => r.CreatedBy).HasMaxLength(200);
                entity.Property(r => r.UpdatedBy).HasMaxLength(200);
            });
        }
    }
}
