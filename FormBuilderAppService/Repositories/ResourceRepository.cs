using Dapper;
using FormBuilderAppService.Models;
using FormBuilderAppService.Repositories.Interfaces;
using Microsoft.Data.SqlClient;
using System.Data;

namespace FormBuilderAppService.Repositories
{
    public class ResourceRepository : IResourceRepository
    {
        private readonly IConfiguration _configuration;

        public ResourceRepository(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        private string GetConnectionString()
        {
            return _configuration.GetConnectionString("PracticeDB") ?? throw new InvalidOperationException("Connection string 'PracticeDB' not found");
        }

        public List<Resource> GetResources(string? resourceType = null)
        {
            using (SqlConnection connection = new SqlConnection(GetConnectionString()))
            {
                connection.Open();
                var resources = connection.Query<Resource>(
                    "dbo.GetResources",
                    commandType: CommandType.StoredProcedure
                ).ToList();
                return resources;
            }
        }

        public Resource? GetResourceById(Guid resourceId)
        {
            using (SqlConnection connection = new SqlConnection(GetConnectionString()))
            {
                connection.Open();
                var resource = connection.QueryFirstOrDefault<Resource>(
                    "dbo.GetResourceById",
                    new { @ResourceId = resourceId },
                    commandType: CommandType.StoredProcedure
                );
                return resource;
            }
        }

        public List<ResourceGroup> GetResourcesList()
        {
            using (SqlConnection connection = new SqlConnection(GetConnectionString()))
            {
                connection.Open();
                var groups = connection.Query<ResourceGroup>(
                    "dbo.GetResourcesList",
                    commandType: CommandType.StoredProcedure
                ).ToList();
                return groups;
            }
            }

        public Guid SaveResource(Resource model)
        {
            using (SqlConnection connection = new SqlConnection(GetConnectionString()))
            {
                connection.Open();
                try
                {
                    var result = connection.QueryFirstOrDefault<Guid?>(
                        "dbo.SaveResource",
                        new
                        {
                            @ResourceType = model.ResourceType,
                            @ComponentName = model.ComponentName,
                            @Description = model.Description,
                            @ResourceJson = model.ResourceJson
                        },
                        commandType: CommandType.StoredProcedure
                    );
                    return result ?? Guid.NewGuid();
                }
                catch (Exception ex)
                {
                    throw new Exception($"Error saving resource: {ex.Message}", ex);
                }
            }
        }

        public void UpdateResource(Resource model)
        {
            using (SqlConnection connection = new SqlConnection(GetConnectionString()))
            {
                connection.Open();
                connection.Execute(
                    "dbo.UpdateResource",
                    new
                    {
                        @ResourceId = model.ResourceId,
                        @ResourceType = model.ResourceType,
                        @ComponentName = model.ComponentName,
                        @Description = model.Description,
                        @ResourceJson = model.ResourceJson
                    },
                    commandType: CommandType.StoredProcedure
                );
            }
        }

        public void DeleteResource(Guid resourceId)
        {
            using (SqlConnection connection = new SqlConnection(GetConnectionString()))
            {
                connection.Open();
                connection.Execute(
                    "dbo.DeleteResource",
                    new { @ResourceId = resourceId },
                    commandType: CommandType.StoredProcedure
                );
            }
        }
    }
}
