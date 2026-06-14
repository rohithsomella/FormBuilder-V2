/*=========================================================
    TABLE : Forms
=========================================================*/

IF OBJECT_ID('dbo.Forms', 'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.Forms;
END
GO

CREATE TABLE dbo.Forms
(
    FormId UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_Forms PRIMARY KEY
        DEFAULT NEWID(),

    FormName NVARCHAR(200) NOT NULL,

    FormTitle NVARCHAR(200) NOT NULL,

    FormTags NVARCHAR(500) NULL,

    FormJson NVARCHAR(MAX) NOT NULL,

    IsDeleted BIT NOT NULL
        CONSTRAINT DF_Forms_IsDeleted DEFAULT (0)
);
GO


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

    INSERT INTO dbo.Forms
    (
        FormName,
        FormTitle,
        FormTags,
        FormJson
    )
    VALUES
    (
        @FormName,
        @FormTitle,
        @FormTags,
        @FormJson
    );
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