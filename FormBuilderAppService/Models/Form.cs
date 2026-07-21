using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FormBuilderAppService.Models
{
    [BsonIgnoreExtraElements]
    public class Form
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }

        [BsonElement("title")]
        public string Title { get; set; } = string.Empty;

        [BsonElement("name")]
        public string Name { get; set; } = string.Empty;

        [BsonElement("components")]
        public BsonArray Components { get; set; } = new();

        [BsonElement("_vid")]
        public int VersionId { get; set; }

        [BsonElement("created")]
        public DateTime Created { get; set; } = DateTime.UtcNow;

        [BsonElement("modified")]
        public DateTime Modified { get; set; } = DateTime.UtcNow;

        [BsonElement("tags")]
        public List<string> Tags { get; set; } = new();

        [BsonElement("project")]
        [BsonRepresentation(BsonType.String)]
        public Guid TenantId { get; set; } = Guid.Empty;

    }
}