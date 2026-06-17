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
    TABLE : FormSubmissions
=========================================================*/

IF OBJECT_ID('dbo.FormSubmissions', 'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.FormSubmissions;
END
GO

CREATE TABLE dbo.FormSubmissions
(
    SubmissionId UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_FormSubmissions PRIMARY KEY
        DEFAULT NEWID(),

    FormId UNIQUEIDENTIFIER NOT NULL,

    SubmissionData NVARCHAR(MAX) NOT NULL,

    SubmissionDate DATETIME NOT NULL
        CONSTRAINT DF_FormSubmissions_SubmissionDate DEFAULT GETUTCDATE(),

    CONSTRAINT FK_FormSubmissions_Forms FOREIGN KEY (FormId)
        REFERENCES dbo.Forms(FormId)
);
GO

