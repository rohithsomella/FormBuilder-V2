using Dapper;
using FormBuilderAppService.Models;
using FormBuilderAppService.Repositories.Interfaces;
using Microsoft.Data.SqlClient;
using MongoDB.Driver.Core.Configuration;
using System.Data;

namespace FormBuilderAppService.Repositories
{
    public class TenantRepository : ITenantRepository
    {
        private readonly IConfiguration _configuration;

        public TenantRepository(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        private string GetConnectionString()
        {
            return _configuration.GetConnectionString("PracticeDB") ?? throw new InvalidOperationException("Connection string 'PracticeDB' not found");
        }

        public List<Tenant> GetTenants()
        {
            using (SqlConnection connection = new SqlConnection(GetConnectionString()))
            {
                connection.Open();
                var tenants = connection.Query<Tenant>(
                    "dbo.GetTenants",
                    commandType: CommandType.StoredProcedure
                ).ToList();
                return tenants;
            }
        }


        public void UpdateTenant(Tenant model)
        {
            using (SqlConnection connection = new SqlConnection(GetConnectionString()))
            {
                connection.Open();
                connection.Execute(
                    "dbo.UpdateTenant",
                    new
                    {
                        @TenantId = model.TenantId,
                        @TenantName = model.TenantName
                    },
                    commandType: CommandType.StoredProcedure
                );
            }
        }

        public void DeleteTenant(Guid tenantId, string? deletedBy = null)
        {
            using (SqlConnection connection = new SqlConnection(GetConnectionString()))
            {
                connection.Open();

                connection.Execute(
                    "dbo.DeleteTenant",
                    new
                    {
                        TenantId = tenantId,
                        DeletedBy = deletedBy
                    },
                    commandType: CommandType.StoredProcedure);
            }
        }


        public async Task<bool> SaveTenant(string tenantName)
        {
            using SqlConnection connection = new SqlConnection(GetConnectionString());

            await connection.OpenAsync();

            await connection.ExecuteAsync(
                "dbo.SaveTenant",
                new
                {
                    TenantName = tenantName
                },
                commandType: CommandType.StoredProcedure);

            return true;
        }
    }
}
