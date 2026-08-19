
/*=========================================================
    TABLE : Tenants
=========================================================*/

-- Batch 1: Check if the table exists and drop it
IF OBJECT_ID('dbo.Tenants', 'U') IS NOT NULL 
BEGIN 
    DROP TABLE dbo.Tenants; 
END
GO 

-- Create the table
CREATE TABLE dbo.Tenants (
    TenantId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Tenants PRIMARY KEY DEFAULT NEWID(),
    TenantName NVARCHAR(200) NOT NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Tenants_IsDeleted DEFAULT (0),
    Created DATETIME NOT NULL CONSTRAINT DF_Tenants_Created DEFAULT GETUTCDATE(),
    Updated DATETIME NOT NULL CONSTRAINT DF_Tenants_Updated DEFAULT GETUTCDATE(),
    CreatedBy NVARCHAR(200) NULL,
    UpdatedBy NVARCHAR(200) NULL,
    Deleted DATETIME NULL,
    DeletedBy NVARCHAR(200) NULL
);
GO

/*=========================================================
    TABLE : Resources
=========================================================*/

IF OBJECT_ID('dbo.Resources', 'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.Resources;
END
GO

CREATE TABLE dbo.Resources
(
    ResourceId UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_Resources PRIMARY KEY
        DEFAULT NEWID(),

    ResourceType NVARCHAR(50) NOT NULL,

    ComponentName NVARCHAR(200) NOT NULL,

    Description NVARCHAR(500) NULL,

    ResourceJson NVARCHAR(MAX) NOT NULL,

    CreatedDate DATETIME NOT NULL
        CONSTRAINT DF_Resources_CreatedDate DEFAULT GETUTCDATE(),

    ModifiedDate DATETIME NOT NULL
        CONSTRAINT DF_Resources_ModifiedDate DEFAULT GETUTCDATE(),

    IsDeleted BIT NOT NULL
        CONSTRAINT DF_Resources_IsDeleted DEFAULT (0)
);
GO


/*=========================================================
    AUTHENTICATION TABLES (ASP.NET Core Identity)
    ---------------------------------------------------------
    DO NOT create these by hand and do not add them to this
    script. They are owned by Entity Framework Core migrations
    and live in the same FormBuilderApp database:

        AspNetUsers
        AspNetRoles
        AspNetUserRoles
        AspNetUserClaims
        AspNetRoleClaims
        AspNetUserLogins
        AspNetUserTokens
        __EFMigrationsHistory

    Created by:
        dotnet ef database update
            --project FormBuilderAppService/FormBuilderAppService.csproj
            --context AppIdentityDbContext

    Migration source: FormBuilderAppService/Migrations/

    Identity also replaces the old custom Users / UserCredentials /
    Roles tables, which were dropped on purpose. Passwords are
    hashed and verified by Identity's own APIs (UserManager /
    SignInManager), so no stored procedure should ever read or
    compare a password.
=========================================================*/
