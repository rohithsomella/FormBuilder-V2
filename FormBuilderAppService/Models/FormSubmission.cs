using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using System.Text.Json.Serialization;

namespace FormBuilderAppService.Models
{
    /// <summary>
    /// Represents a Form.io submission stored as a MongoDB document.
    /// Stores the complete Formio submission with all properties.
    /// </summary>
    public class FormSubmission
    {
        [BsonId]
        [JsonPropertyName("_id")]
        public string? Id { get; set; }

        /// <summary>
        /// The Form ID (MongoDB ObjectId) that this submission belongs to
        /// </summary>
        [BsonElement("form")]
        [JsonPropertyName("form")]
        public string? FormId { get; set; }

        /// <summary>
        /// Form version ID - extracted from form._vid
        /// </summary>
        [BsonElement("_fvid")]
        [JsonPropertyName("_fvid")]
        public int FormVersionId { get; set; }

        /// <summary>
        /// Project ID (currently empty, for future use)
        /// </summary>
        [BsonElement("project")]
        [JsonPropertyName("project")]
        public string? Project { get; set; }

        /// <summary>
        /// Submission state (e.g., "submitted")
        /// </summary>
        [BsonElement("state")]
        [JsonPropertyName("state")]
        public string? State { get; set; }

        /// <summary>
        /// Form submission data - the actual form answers
        /// Stored as a JSON document in MongoDB
        /// </summary>
        [BsonElement("data")]
        [JsonPropertyName("data")]
        public Dictionary<string, object?>? Data { get; set; }

        /// <summary>
        /// Submission metadata
        /// Stored as a JSON document in MongoDB
        /// </summary>
        [BsonElement("metadata")]
        [JsonPropertyName("metadata")]
        public Dictionary<string, object?>? Metadata { get; set; }

        /// <summary>
        /// External IDs array (currently empty)
        /// </summary>
        [BsonElement("externalIds")]
        [JsonPropertyName("externalIds")]
        public List<object?>? ExternalIds { get; set; }

        /// <summary>
        /// External tokens array (currently empty)
        /// </summary>
        [BsonElement("externalTokens")]
        [JsonPropertyName("externalTokens")]
        public List<object?>? ExternalTokens { get; set; }

        /// <summary>
        /// Document version for MongoDB versioning
        /// </summary>
        [BsonElement("__v")]
        [JsonPropertyName("__v")]
        public int Version { get; set; }

        /// <summary>
        /// Submission creation date (UTC)
        /// </summary>
        [BsonElement("created")]
        [JsonPropertyName("created")]
        public DateTime Created { get; set; }

        /// <summary>
        /// Submission last modified date (UTC)
        /// </summary>
        [BsonElement("modified")]
        [JsonPropertyName("modified")]
        public DateTime Modified { get; set; }

        /// <summary>
        /// Additional fields from Formio that we preserve
        /// Stores any other Formio properties not explicitly defined above
        /// </summary>
        [BsonExtraElements]
        [JsonExtensionData]
        public Dictionary<string, object>? AdditionalProperties { get; set; }
    }
}