using FormBuilderAppService.Data;
using FormBuilderAppService.Models;
using FormBuilderAppService.Repositories.Interfaces;
using MongoDB.Bson;
using MongoDB.Driver;
using System.Text.Json;

namespace FormBuilderAppService.Repositories
{
    public class FormSubmissionRepository : IFormSubmissionRepository
    {
        private readonly IMongoCollection<FormSubmission> _formSubmissions;
        private readonly ILogger<FormSubmissionRepository> _logger;

        public FormSubmissionRepository(
            MongoDbContext context,
            ILogger<FormSubmissionRepository> logger)
        {
            _formSubmissions = context.FormSubmissions;
            _logger = logger;
        }

        public async Task<string> SaveFormSubmissionAsync(JsonElement submission)
        {
            try
            {
                // Validate submission is not empty
                if (submission.ValueKind == JsonValueKind.Null || submission.ValueKind == JsonValueKind.Undefined)
                {
                    _logger.LogError("❌ Submission is null or undefined");
                    throw new ArgumentException("Submission cannot be null or empty");
                }

                // Convert JsonElement to BsonDocument for easier extraction
                string jsonString = submission.GetRawText();

                BsonDocument bsonDoc;
                try
                {
                    bsonDoc = BsonDocument.Parse(jsonString);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "❌ Failed to parse submission as BsonDocument");
                    throw new ArgumentException("Invalid JSON in submission", ex);
                }

                // Extract and validate Form ID
                string? formId = null;
                if (bsonDoc.Contains("form"))
                {
                    formId = bsonDoc["form"].AsString;
                }

                if (string.IsNullOrWhiteSpace(formId))
                {
                    _logger.LogError("❌ Form ID is required");
                    throw new ArgumentException("Submission must contain a 'form' property with the Form ID");
                }

                // Generate or use existing submission ID
                string submissionId;
                if (bsonDoc.Contains("_id") && bsonDoc["_id"].BsonType == BsonType.String)
                {
                    submissionId = bsonDoc["_id"].AsString;
                }
                else
                {
                    submissionId = ObjectId.GenerateNewId().ToString();
                }

                // Extract dates
                DateTime createdDate = DateTime.UtcNow;
                if (bsonDoc.Contains("created") && bsonDoc["created"].BsonType != BsonType.Null)
                {
                    try
                    {
                        createdDate = bsonDoc["created"].ToUniversalTime();
                    }
                    catch
                    {
                        // Use default UtcNow
                    }
                }

                DateTime modifiedDate = DateTime.UtcNow;

                // Extract form version
                int formVersionId = 0;
                if (bsonDoc.Contains("_fvid") && bsonDoc["_fvid"].BsonType == BsonType.Int32)
                {
                    formVersionId = bsonDoc["_fvid"].AsInt32;
                }

                // Extract state
                string state = "submitted";
                if (bsonDoc.Contains("state") && bsonDoc["state"].BsonType == BsonType.String)
                {
                    state = bsonDoc["state"].AsString;
                }

                // Extract data
                Dictionary<string, object?>? data = null;
                if (bsonDoc.Contains("data") && bsonDoc["data"].BsonType == BsonType.Document)
                {
                    var dataDoc = bsonDoc["data"].AsBsonDocument;
                    data = BsonDocumentToDict(dataDoc);
                }

                // Extract metadata
                Dictionary<string, object?>? metadata = null;
                if (bsonDoc.Contains("metadata") && bsonDoc["metadata"].BsonType == BsonType.Document)
                {
                    var metadataDoc = bsonDoc["metadata"].AsBsonDocument;
                    metadata = BsonDocumentToDict(metadataDoc);
                }

                // Extract externalIds and externalTokens
                List<object?>? externalIds = null;
                if (bsonDoc.Contains("externalIds") && bsonDoc["externalIds"].BsonType == BsonType.Array)
                {
                    externalIds = BsonArrayToList(bsonDoc["externalIds"].AsBsonArray);
                }
                else
                {
                    externalIds = new List<object?>();
                }

                List<object?>? externalTokens = null;
                if (bsonDoc.Contains("externalTokens") && bsonDoc["externalTokens"].BsonType == BsonType.Array)
                {
                    externalTokens = BsonArrayToList(bsonDoc["externalTokens"].AsBsonArray);
                }
                else
                {
                    externalTokens = new List<object?>();
                }

                // Create FormSubmission object
                var formSubmission = new FormSubmission
                {
                    Id = submissionId,
                    FormId = formId,
                    FormVersionId = formVersionId,
                    Project = bsonDoc.Contains("project") ? bsonDoc["project"].AsString : "",
                    State = state,
                    Data = data,
                    Metadata = metadata,
                    ExternalIds = externalIds,
                    ExternalTokens = externalTokens,
                    Version = 0,
                    Created = createdDate,
                    Modified = modifiedDate,
                    AdditionalProperties = new Dictionary<string, object>()
                };

                await _formSubmissions.InsertOneAsync(formSubmission);

                _logger.LogInformation("✅ Form submission saved: SubmissionId={SubmissionId}, FormId={FormId}", submissionId, formId);

                return submissionId;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error saving form submission");
                throw;
            }
        }

        public async Task<List<FormSubmission>> GetFormSubmissionsAsync(string formId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(formId))
                {
                    _logger.LogWarning("Invalid FormId");
                    return new List<FormSubmission>();
                }

                var filter = Builders<FormSubmission>.Filter.Eq(fs => fs.FormId, formId);
                var submissions = await _formSubmissions
                    .Find(filter)
                    .SortByDescending(fs => fs.Modified)
                    .ToListAsync();

                _logger.LogInformation("✅ Fetched {Count} submissions for FormId: {FormId}", submissions.Count, formId);

                return submissions;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error retrieving submissions for FormId: {FormId}", formId);
                throw;
            }
        }

        public async Task<FormSubmission?> GetFormSubmissionByIdAsync(string submissionId)
        {
            try
            {
                var filter = Builders<FormSubmission>.Filter.Eq(fs => fs.Id, submissionId);
                var submission = await _formSubmissions.Find(filter).FirstOrDefaultAsync();

                if (submission == null)
                {
                    _logger.LogWarning("Submission not found: {SubmissionId}", submissionId);
                    return null;
                }

                return submission;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error retrieving submission: {SubmissionId}", submissionId);
                throw;
            }
        }

        /// <summary>
        /// Convert BsonValue to a JSON-serializable object
        /// </summary>
        private object? BsonValueToObject(BsonValue bsonValue)
        {
            return bsonValue.BsonType switch
            {
                BsonType.Document => BsonDocumentToDict(bsonValue.AsBsonDocument),
                BsonType.Array => bsonValue.AsBsonArray.Select(BsonValueToObject).ToList(),
                BsonType.String => bsonValue.AsString,
                BsonType.Int32 => bsonValue.AsInt32,
                BsonType.Int64 => bsonValue.AsInt64,
                BsonType.Double => bsonValue.AsDouble,
                BsonType.Boolean => bsonValue.AsBoolean,
                BsonType.DateTime => ((BsonDateTime)bsonValue).ToUniversalTime(),
                BsonType.ObjectId => bsonValue.AsObjectId.ToString(),
                BsonType.Null => null,
                _ => bsonValue.ToString()
            };
        }

        /// <summary>
        /// Convert BsonDocument to Dictionary for JSON serialization
        /// </summary>
        private Dictionary<string, object?> BsonDocumentToDict(BsonDocument doc)
        {
            var dict = new Dictionary<string, object?>();
            foreach (var element in doc.Elements)
            {
                dict[element.Name] = BsonValueToObject(element.Value);
            }
            return dict;
        }

        /// <summary>
        /// Convert BsonArray to List for JSON serialization
        /// </summary>
        private List<object?> BsonArrayToList(BsonArray arr)
        {
            var list = new List<object?>();
            foreach (var item in arr)
            {
                list.Add(BsonValueToObject(item));
            }
            return list;
        }
    }
}
