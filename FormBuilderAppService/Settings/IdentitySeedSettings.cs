namespace FormBuilderAppService.Settings
{
    /// <summary>
    /// Bound from the "IdentitySeed" configuration section.
    ///
    /// Seeding exists so a fresh database has something to log in with. Accounts are
    /// described here rather than in C# so that no credential - and no notion of "this
    /// particular username is the admin" - is compiled into the application. Admin
    /// status comes from the Roles list below, which is written into AspNetUserRoles.
    /// </summary>
    public class IdentitySeedSettings
    {
        public bool Enabled { get; set; }

        public List<SeedUser> Users { get; set; } = new();

        public class SeedUser
        {
            public string UserName { get; set; } = string.Empty;

            public string Email { get; set; } = string.Empty;

            public string FullName { get; set; } = string.Empty;

            public string Password { get; set; } = string.Empty;

            public List<string> Roles { get; set; } = new();
        }
    }
}
