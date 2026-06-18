using Dapper;
using FormBuilderAppService.Models;
using FormBuilderAppService.Repositories.Interfaces;
using Microsoft.Data.SqlClient;
using System.Data;

namespace FormBuilderAppService.Repositories
{
    public class FormSubmissionRepository : IFormSubmissionRepository
    {
        private readonly IConfiguration _configuration;

        public FormSubmissionRepository(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        private string GetConnectionString()
        {
            return _configuration.GetConnectionString("PracticeDB") ?? throw new InvalidOperationException("Connection string 'PracticeDB' not found");
        }

        public Guid SaveFormSubmission(Guid formId, string submissionData)
        {
            using (SqlConnection connection = new SqlConnection(GetConnectionString()))
            {
                connection.Open();
                try
                {
                    var result = connection.QueryFirstOrDefault<Guid?>(
                        "dbo.SaveFormSubmission",
                        new
                        {
                            @FormId = formId,
                            @SubmissionData = submissionData
                        },
                        commandType: CommandType.StoredProcedure
                    );
                    return result ?? Guid.NewGuid();
                }
                catch (Exception ex)
                {
                    throw new Exception($"Error saving form submission: {ex.Message}", ex);
                }
            }
        }

        public List<FormSubmission> GetFormSubmissions(Guid formId)
        {
            using (SqlConnection connection = new SqlConnection(GetConnectionString()))
            {
                connection.Open();
                var submissions = connection.Query<FormSubmission>(
                    "dbo.GetFormSubmissions",
                    new { @FormId = formId },
                    commandType: CommandType.StoredProcedure
                ).ToList();
                return submissions;
            }
        }

        public FormSubmission? GetFormSubmissionById(Guid submissionId)
        {
            using (SqlConnection connection = new SqlConnection(GetConnectionString()))
            {
                connection.Open();
                var submission = connection.QueryFirstOrDefault<FormSubmission>(
                    "dbo.GetFormSubmissionById",
                    new { @SubmissionId = submissionId },
                    commandType: CommandType.StoredProcedure
                );
                return submission;
            }
        }
    }
}
