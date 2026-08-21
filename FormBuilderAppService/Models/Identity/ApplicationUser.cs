using Microsoft.AspNetCore.Identity;

namespace FormBuilderAppService.Models.Identity
{
    /// <summary>
    /// The application's user. Everything Identity already provides - UserName, Email,
    /// PasswordHash, SecurityStamp, lockout and confirmation flags - is inherited and
    /// must not be re-implemented.
    ///
    /// Guid keys are used to match the rest of the schema (Forms, Tenants and
    /// FormSubmissions are all UNIQUEIDENTIFIER).
    /// </summary>
    public class ApplicationUser : IdentityUser<Guid>
    {
        public string? FirstName { get; set; }

        public string? LastName { get; set; }

        /// <summary>
        /// Kept as a stored column rather than computed from FirstName + LastName: the
        /// seeded accounts and the login response have always carried it, and a seed
        /// entry supplies a full name without supplying the two parts.
        /// </summary>
        public string? FullName { get; set; }

        /// <summary>
        /// When the account was created. Identity does not track this, and the User
        /// Details table sorts on it ("New - Old" / "Old - New").
        ///
        /// Server local time, not UTC. That differs from the Tenants table, which
        /// defaults to GETUTCDATE() - these columns are read back as wall-clock time.
        /// </summary>
        public DateTime Created { get; set; } = DateTime.Now;

        /// <summary>
        /// Last time the row changed. Non-null and equal to <see cref="Created"/> on
        /// insert, matching how Tenants.Updated defaults on its INSERT - so "when was
        /// this last touched" always has an answer.
        /// </summary>
        public DateTime Updated { get; set; } = DateTime.Now;

        /// <summary>
        /// Username of the admin who created the account, or "System" for seeded ones.
        /// A name rather than a foreign key, so deleting an admin cannot orphan the row.
        /// </summary>
        public string? CreatedBy { get; set; }

        public string? UpdatedBy { get; set; }

        /// <summary>
        /// Soft delete. Rows are kept so submissions and audit trails keep resolving to
        /// a real account; the user list filters these out.
        /// </summary>
        public bool IsDeleted { get; set; }

        /// <summary>
        /// Whether the account is usable. Separate from IsDeleted: an account can be
        /// suspended and later re-enabled without ever having been deleted.
        /// </summary>
        public bool IsActive { get; set; } = true;
    }
}
