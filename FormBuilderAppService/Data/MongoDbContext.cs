using FormBuilderAppService.Models;
using FormBuilderAppService.Settings;
using Microsoft.Extensions.Options;
using MongoDB.Driver;

namespace FormBuilderAppService.Data
{
    public class MongoDbContext
    {
        private readonly IMongoDatabase _database;

        public MongoDbContext(
            IMongoClient mongoClient,
            IOptions<MongoDbSettings> settings)
        {
            _database = mongoClient.GetDatabase(settings.Value.DatabaseName);
        }

        public IMongoDatabase Database => _database;

        public IMongoCollection<Form> Forms =>
            _database.GetCollection<Form>("Forms");

        public IMongoCollection<FormSubmission> FormSubmissions =>
            _database.GetCollection<FormSubmission>("FormSubmissions");

        public IMongoCollection<Resource> Resources =>
            _database.GetCollection<Resource>("Resources");

        public IMongoCollection<ResourceGroup> ResourceGroups =>
            _database.GetCollection<ResourceGroup>("ResourceGroups");
    }
}