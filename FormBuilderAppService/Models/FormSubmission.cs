using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FormBuilderAppService.Models
{
    public class FormSubmission
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }

        public Guid SubmissionId { get; set; }

        public Guid FormId { get; set; }

        public string? SubmissionData { get; set; }

        public DateTime SubmissionDate { get; set; } = DateTime.UtcNow;
    }
}