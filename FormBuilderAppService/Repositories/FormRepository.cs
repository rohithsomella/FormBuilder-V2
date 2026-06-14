using Dapper;
using FormBuilderAppService.Models;
using Microsoft.Data.SqlClient;
using System.Data;

namespace FormBuilderAppService.Repositories
{
    public class FormRepository : IFormRepository
    {
        private readonly IConfiguration _configuration;

        public FormRepository(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        private string GetConnectionString()
        {
            return _configuration.GetConnectionString("RohitDotNET");
        }

        public List<Form> GetForms()
        {
            using (SqlConnection connection = new SqlConnection(GetConnectionString()))
            {
                connection.Open();
                var forms = connection.Query<Form>(
                    "dbo.GetForms",
                    commandType: CommandType.StoredProcedure
                ).ToList();
                return forms;
            }
        }

        public Form GetFormById(Guid formId)
        {
            using (SqlConnection connection = new SqlConnection(GetConnectionString()))
            {
                connection.Open();
                var form = connection.QueryFirstOrDefault<Form>(
                    "dbo.GetFormById",
                    new { @FormId = formId },
                    commandType: CommandType.StoredProcedure
                );
                return form;
            }
        }

        public void SaveForm(Form model)
        {
            using (SqlConnection connection = new SqlConnection(GetConnectionString()))
            {
                connection.Open();
                connection.Execute(
                    "dbo.SaveForm",
                    new
                    {
                        @FormName = model.FormName,
                        @FormTitle = model.FormTitle,
                        @FormTags = model.FormTags,
                        @FormJson = model.FormJson
                    },
                    commandType: CommandType.StoredProcedure
                );
            }
        }
    }
}
