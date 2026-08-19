namespace FormBuilderAppService.Models.DTOs.Auth
{
    /// <summary>
    /// The single login request. There is one login flow: LoginIdentifier accepts either
    /// a username or an email address and the backend works out which it is.
    ///
    /// Deliberately carries no [Required] attributes. With [ApiController], a failed
    /// validation attribute short-circuits into a 400 with field-level detail before the
    /// action runs - which would make "you left the password blank" externally
    /// distinguishable from "that password is wrong". Empty values are checked in the
    /// action instead, so every rejected login looks identical from outside.
    /// </summary>
    public class LoginRequest
    {
        public string LoginIdentifier { get; set; } = string.Empty;

        public string Password { get; set; } = string.Empty;
    }

    /// <summary>
    /// Returned on a successful login. The user block is for rendering the UI only -
    /// every authorization decision is made from the signed token, never from this.
    /// </summary>
    public class LoginResponse
    {
        public string Token { get; set; } = string.Empty;

        public DateTime ExpiresAtUtc { get; set; }

        public CurrentUserDto User { get; set; } = new();
    }

    /// <summary>
    /// The authenticated user as the frontend sees them. Built from the validated token
    /// and Identity, so /api/auth/me is the authoritative answer to "who am I".
    /// </summary>
    public class CurrentUserDto
    {
        public Guid UserId { get; set; }

        public string UserName { get; set; } = string.Empty;

        public string Email { get; set; } = string.Empty;

        public string? FullName { get; set; }

        public List<string> Roles { get; set; } = new();

        /// <summary>
        /// Convenience flag for the UI's role check. Derived from Roles - it is not a
        /// separately stored value that could disagree with the token.
        /// </summary>
        public bool IsAdmin =>
            Roles.Any(r => string.Equals(r, RoleNames.Admin, StringComparison.OrdinalIgnoreCase));
    }

    /// <summary>
    /// Role names used by V1. Constants rather than literals so a typo in an
    /// [Authorize(Roles = ...)] attribute is a compile error, not a silent 403.
    /// </summary>
    public static class RoleNames
    {
        public const string Admin = "Admin";
        public const string User = "User";

        public static readonly string[] All = { Admin, User };
    }
}
