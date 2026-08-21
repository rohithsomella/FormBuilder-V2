using FormBuilderAppService.Models.DTOs.Auth;

namespace FormBuilderAppService.Models.DTOs.Users
{
    /// <summary>
    /// What the "Add New User" dialog sends. Roles is a list because the dialog is a
    /// multi-select: an account can be an Admin and a Dev at the same time.
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
    /// One row of the User Details table. Deliberately mirrors what the table renders -
    /// nothing sensitive (no password hash, no security stamp) is exposed here.
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

        public DateTime Created { get; set; }
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
    /// A role the dialog offers in its dropdown. Sourced from <see cref="RoleNames.All"/>
    /// via AspNetRoles, so the dropdown can never offer something the API would reject.
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
}
