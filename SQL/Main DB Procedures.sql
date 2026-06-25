
/*=========================================================
    PROCEDURE : SaveForm
=========================================================*/

CREATE OR ALTER PROCEDURE dbo.SaveForm
(
    @FormName NVARCHAR(200),
    @FormTitle NVARCHAR(200),
    @FormTags NVARCHAR(500),
    @FormJson NVARCHAR(MAX)
)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @NewFormId UNIQUEIDENTIFIER = NEWID();

    INSERT INTO dbo.Forms
    (
        FormId,
        FormName,
        FormTitle,
        FormTags,
        FormJson
    )
    VALUES
    (
        @NewFormId,
        @FormName,
        @FormTitle,
        @FormTags,
        @FormJson
    );

    SET NOCOUNT OFF;
    SELECT @NewFormId AS FormId;
END
GO


/*=========================================================
    PROCEDURE : UpdateForm
=========================================================*/

CREATE OR ALTER PROCEDURE dbo.UpdateForm
(
    @FormId UNIQUEIDENTIFIER,
    @FormName NVARCHAR(200),
    @FormTitle NVARCHAR(200),
    @FormTags NVARCHAR(500),
    @FormJson NVARCHAR(MAX)
)
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.Forms
    SET 
        FormName = @FormName,
        FormTitle = @FormTitle,
        FormTags = @FormTags,
        FormJson = @FormJson
    WHERE FormId = @FormId
      AND IsDeleted = 0;
END
GO


/*=========================================================
    PROCEDURE : GetForms
=========================================================*/

CREATE OR ALTER PROCEDURE dbo.GetForms
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        FormId,
        FormName,
        FormTitle,
        FormTags
    FROM dbo.Forms
    WHERE IsDeleted = 0
    ORDER BY FormName;
END
GO


/*=========================================================
    PROCEDURE : GetFormById
=========================================================*/

CREATE OR ALTER PROCEDURE dbo.GetFormById
(
    @FormId UNIQUEIDENTIFIER
)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        FormId,
        FormName,
        FormTitle,
        FormTags,
        FormJson
    FROM dbo.Forms
    WHERE FormId = @FormId
      AND IsDeleted = 0;
END
GO


/*=========================================================
    PROCEDURE : DeleteForm
=========================================================*/

CREATE OR ALTER PROCEDURE dbo.DeleteForm
(
    @FormId UNIQUEIDENTIFIER
)
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.Forms
    SET IsDeleted = 1
    WHERE FormId = @FormId;
END
GO

/*=========================================================
    PROCEDURE : SaveFormSubmission
=========================================================*/

CREATE OR ALTER PROCEDURE dbo.SaveFormSubmission
(
    @FormId UNIQUEIDENTIFIER,
    @SubmissionData NVARCHAR(MAX)
)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @NewSubmissionId UNIQUEIDENTIFIER = NEWID();

    INSERT INTO dbo.FormSubmissions
    (
        SubmissionId,
        FormId,
        SubmissionData
    )
    VALUES
    (
        @NewSubmissionId,
        @FormId,
        @SubmissionData
    );

    SET NOCOUNT OFF;
    SELECT @NewSubmissionId AS SubmissionId;
END
GO

/*=========================================================
    PROCEDURE : GetFormSubmissions
=========================================================*/

CREATE OR ALTER PROCEDURE dbo.GetFormSubmissions
(
    @FormId UNIQUEIDENTIFIER
)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        SubmissionId,
        FormId,
        SubmissionData,
        SubmissionDate
    FROM dbo.FormSubmissions
    WHERE FormId = @FormId
    ORDER BY SubmissionDate DESC;
END
GO

/*=========================================================
    PROCEDURE : GetFormSubmissionById
=========================================================*/

CREATE OR ALTER PROCEDURE dbo.GetFormSubmissionById
(
    @SubmissionId UNIQUEIDENTIFIER
)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        fs.SubmissionId,
        fs.FormId,
        f.FormName,
        fs.SubmissionData,
        fs.SubmissionDate
    FROM dbo.FormSubmissions fs
    INNER JOIN dbo.Forms f
        ON fs.FormId = f.FormId
    WHERE fs.SubmissionId = @SubmissionId;
END
GO

/*=========================================================  
    PROCEDURE : GetFormSubmissionReports  
=========================================================*/  
 CREATE OR ALTER PROCEDURE dbo.GetFormSubmissionReports
(
    @FormId UNIQUEIDENTIFIER,
    @LocationID UNIQUEIDENTIFIER = NULL,
    @FromDate DATETIME,
    @ToDate DATETIME
)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        SubmissionId,
        FormId,
        PracticeID,
        LocationID,
        UserID,
        PatientID,
        IsDeleted,
        SubmissionData,
        SubmissionDate
    FROM dbo.FormSubmissions
    WHERE FormId = @FormId
      AND (@LocationID IS NULL OR LocationID = @LocationID)
      AND IsDeleted = 0
      AND SubmissionDate >= @FromDate
      AND SubmissionDate < DATEADD(DAY, 1, @ToDate)
    ORDER BY SubmissionDate DESC;
END
GO

/*=========================================================
    PROCEDURE : SaveResource
=========================================================*/

CREATE OR ALTER PROCEDURE dbo.SaveResource
(
    @ResourceType NVARCHAR(50),
    @ComponentName NVARCHAR(200),
    @Description NVARCHAR(500),
    @ResourceJson NVARCHAR(MAX)
)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @NewResourceId UNIQUEIDENTIFIER = NEWID();

    INSERT INTO dbo.Resources
    (
        ResourceType,
        ComponentName,
        Description,
        ResourceJson
    )
    VALUES
    (
        @ResourceType,
        @ComponentName,
        @Description,
        @ResourceJson
    );

    SET NOCOUNT OFF;
    SELECT @NewResourceId AS ResourceId;
END
GO

/*=========================================================
    PROCEDURE : GetResources
=========================================================*/

CREATE OR ALTER PROCEDURE dbo.GetResources
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        ResourceId,
        ResourceType,
        ComponentName,
        Description,
        ResourceJson,
        CreatedDate,
        ModifiedDate
    FROM dbo.Resources
    WHERE IsDeleted = 0
    ORDER BY ResourceType, ComponentName;
END
GO

/*=========================================================
    PROCEDURE : GetResourceById
=========================================================*/

CREATE OR ALTER PROCEDURE dbo.GetResourceById
(
    @ResourceId UNIQUEIDENTIFIER
)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        ResourceId,
        ResourceType,
        ComponentName,
        Description,
        ResourceJson,
        CreatedDate,
        ModifiedDate
    FROM dbo.Resources
    WHERE ResourceId = @ResourceId
      AND IsDeleted = 0;
END
GO

/*=========================================================
    PROCEDURE : UpdateResource
=========================================================*/

CREATE OR ALTER PROCEDURE dbo.UpdateResource
(
    @ResourceId UNIQUEIDENTIFIER,
    @ResourceType NVARCHAR(50),
    @ComponentName NVARCHAR(200),
    @Description NVARCHAR(500),
    @ResourceJson NVARCHAR(MAX)
)
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.Resources
    SET
        ResourceType = @ResourceType,
        ComponentName = @ComponentName,
        Description = @Description,
        ResourceJson = @ResourceJson,
        ModifiedDate = GETUTCDATE()
    WHERE ResourceId = @ResourceId
      AND IsDeleted = 0;
END
GO

/*=========================================================
    PROCEDURE : DeleteResource
=========================================================*/

CREATE OR ALTER PROCEDURE dbo.DeleteResource
(
    @ResourceId UNIQUEIDENTIFIER
)
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.Resources
    SET 
        IsDeleted = 1,
        ModifiedDate = GETUTCDATE()
    WHERE ResourceId = @ResourceId;
END
GO

/*=========================================================
    PROCEDURE : GetResourcesList
    Returns resources grouped by ResourceType name
    Useful for displaying resources organized by type
=========================================================*/

CREATE OR ALTER PROCEDURE dbo.GetResourcesList
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        ResourceType,
        COUNT(*) AS ItemCount,
        STRING_AGG(ComponentName, ', ') AS ComponentsList,
        MIN(CreatedDate) AS CreatedDate
    FROM dbo.Resources
    WHERE IsDeleted = 0
    GROUP BY ResourceType
    ORDER BY ResourceType;
END
GO