using FormBuilderAppService.Models.DTOs.Auth;

namespace FormBuilderAppService.Models.DTOs.Users
{
    /// <summary>
    /// What the "Add New User" dialog sends. Roles is a list because the dialog is a
    /// multi-select: an account can hold several roles at once.
    ///
    /// No password field. The API generates one (see <see cref="CreateUserResponse"/>),
    /// so a password is never typed into a form, never sent over the wire on the way in,
    /// and never has to be invented by whoever is creating the account.
    /// </summary>
    public class CreateUserRequest
    {
        public string FirstName { get; set; } = string.Empty;

        public string LastName { get; set; } = string.Empty;

        public string UserName { get; set; } = string.Empty;

        public string Email { get; set; } = string.Empty;

        public List<string> Roles { get; set; } = new();
    }

    /// <summary>
    /// What the Edit User dialog sends back. Only the four fields the dialog can unlock,
    /// plus the active flag behind its toggle.
    ///
    /// No audit fields. Updated and UpdatedBy are written by the service from the caller's
    /// token - accepting them here would let the request claim somebody else made the
    /// change, and Created/CreatedBy are history that an edit has no business rewriting.
    ///
    /// No email either: the dialog does not show it, so a request that omitted it would
    /// otherwise read as "clear this user's email".
    /// </summary>
    public class UpdateUserRequest
    {
        public string FirstName { get; set; } = string.Empty;

        public string LastName { get; set; } = string.Empty;

        public string UserName { get; set; } = string.Empty;

        public List<string> Roles { get; set; } = new();

        public bool IsActive { get; set; }
    }

    /// <summary>
    /// One row of the User Details table, and everything the Edit User dialog shows.
    /// Deliberately mirrors what those two render - nothing sensitive (no password hash,
    /// no security stamp) is exposed here.
    /// </summary>
    public class UserListItemDto
    {
        public Guid UserId { get; set; }

        public string UserName { get; set; } = string.Empty;

        public string FirstName { get; set; } = string.Empty;

        public string LastName { get; set; } = string.Empty;

        public string FullName { get; set; } = string.Empty;

        public string Email { get; set; } = string.Empty;

        public List<string> Roles { get; set; } = new();

        /// <summary>
        /// The reversible suspension, not the soft delete. AuthService refuses to sign in
        /// an account with this false, so the dialog's toggle really does disable someone.
        /// </summary>
        public bool IsActive { get; set; }

        public DateTime Created { get; set; }

        public string CreatedBy { get; set; } = string.Empty;

        public DateTime Updated { get; set; }

        public string UpdatedBy { get; set; } = string.Empty;
    }

    /// <summary>
    /// The result of a successful create.
    ///
    /// TemporaryPassword is the ONLY time the generated password exists outside the hash
    /// in AspNetUsers - it is not stored anywhere in plain form and cannot be read back
    /// later. The dialog shows it once for the admin to hand over; after that the only
    /// way to recover the account is a reset.
    /// </summary>
    public class CreateUserResponse
    {
        public UserListItemDto User { get; set; } = new();

        public string TemporaryPassword { get; set; } = string.Empty;
    }

    /// <summary>
    /// Answer for the "Verify" button beside the username box.
    /// </summary>
    public class UserNameAvailabilityDto
    {
        public string UserName { get; set; } = string.Empty;

        public bool IsAvailable { get; set; }

        public string Message { get; set; } = string.Empty;
    }

    /// <summary>
    /// A role the dialog offers in its dropdown. Read straight from AspNetRoles, so the
    /// dropdown can never offer something the API would reject - and a role added by
    /// SQL appears without a rebuild.
    /// </summary>
    public class RoleOptionDto
    {
        public string Name { get; set; } = string.Empty;

        public string? Description { get; set; }
    }

    /// <summary>
    /// Service-layer outcome of a create attempt. Lets the controller tell "the request
    /// was bad" (400, with the reasons) apart from "it worked" without throwing, and
    /// without the service having to know about HTTP.
    /// </summary>
    public class CreateUserResult
    {
        public bool Succeeded { get; private init; }

        public CreateUserResponse? Created { get; private init; }

        public List<string> Errors { get; private init; } = new();

        public static CreateUserResult Success(CreateUserResponse created) => new()
        {
            Succeeded = true,
            Created = created
        };

        public static CreateUserResult Failure(params string[] errors) => new()
        {
            Succeeded = false,
            Errors = errors.ToList()
        };

        public static CreateUserResult Failure(IEnumerable<string> errors) => new()
        {
            Succeeded = false,
            Errors = errors.ToList()
        };
    }

    /// <summary>
    /// Service-layer outcome of an edit. Same shape as <see cref="CreateUserResult"/>,
    /// with one extra state: an id that matches nobody is a 404 rather than a 400, so
    /// "you asked for a user that is not there" does not read as "your data was wrong".
    /// </summary>
    public class UpdateUserResult
    {
        public bool Succeeded { get; private init; }

        public bool NotFound { get; private init; }

        public UserListItemDto? Updated { get; private init; }

        public List<string> Errors { get; private init; } = new();

        public static UpdateUserResult Success(UserListItemDto updated) => new()
        {
            Succeeded = true,
            Updated = updated
        };

        public static UpdateUserResult Missing() => new()
        {
            Succeeded = false,
            NotFound = true,
            Errors = { "That user no longer exists." }
        };

        public static UpdateUserResult Failure(params string[] errors) => new()
        {
            Succeeded = false,
            Errors = errors.ToList()
        };

        public static UpdateUserResult Failure(IEnumerable<string> errors) => new()
        {
            Succeeded = false,
            Errors = errors.ToList()
        };
    }

    /// <summary>
    /// What the Edit dialog's "Change Password" panel sends.
    ///
    /// Deliberately its own request rather than a field on <see cref="UpdateUserRequest"/>.
    /// A password does not belong on the general-purpose update DTO: that one is bound on
    /// every save, appears in the generated API description, and would carry a plaintext
    /// secret through model binding on requests that never intended to set one.
    ///
    /// No current-password field. This is an admin resetting somebody else's account, not
    /// a user changing their own - the authority is the caller's Admin role, which the
    /// controller has already established from the token.
    /// </summary>
    public class SetUserPasswordRequest
    {
        public string NewPassword { get; set; } = string.Empty;

        /// <summary>
        /// Re-checked here even though the dialog compares them first. A typo protected
        /// only by client-side script is not protected at all, and the cost of getting
        /// this wrong is an account whose password nobody knows.
        /// </summary>
        public string ConfirmPassword { get; set; } = string.Empty;
    }

    /// <summary>
    /// Service-layer outcome of a password reset. Carries nothing back but the verdict -
    /// there is no state here worth returning, and certainly not the password.
    /// </summary>
    public class SetPasswordResult
    {
        public bool Succeeded { get; private init; }

        public bool NotFound { get; private init; }

        public List<string> Errors { get; private init; } = new();

        public static SetPasswordResult Success() => new()
        {
            Succeeded = true
        };

        public static SetPasswordResult Missing() => new()
        {
            Succeeded = false,
            NotFound = true,
            Errors = { "That user no longer exists." }
        };

        public static SetPasswordResult Failure(params string[] errors) => new()
        {
            Succeeded = false,
            Errors = errors.ToList()
        };

        public static SetPasswordResult Failure(IEnumerable<string> errors) => new()
        {
            Succeeded = false,
            Errors = errors.ToList()
        };
    }

    /// <summary>
    /// Service-layer outcome of a delete.
    ///
    /// Carries no user back. The row still exists - this is a soft delete - but it is no
    /// longer part of "the users" as far as the caller is concerned, so handing back a
    /// record of it would invite somebody to render a deleted account.
    /// </summary>
    public class DeleteUserResult
    {
        public bool Succeeded { get; private init; }

        public bool NotFound { get; private init; }

        public List<string> Errors { get; private init; } = new();

        public static DeleteUserResult Success() => new()
        {
            Succeeded = true
        };

        public static DeleteUserResult Missing() => new()
        {
            Succeeded = false,
            NotFound = true,
            Errors = { "That user no longer exists." }
        };

        public static DeleteUserResult Failure(params string[] errors) => new()
        {
            Succeeded = false,
            Errors = errors.ToList()
        };

        public static DeleteUserResult Failure(IEnumerable<string> errors) => new()
        {
            Succeeded = false,
            Errors = errors.ToList()
        };
    }
}
