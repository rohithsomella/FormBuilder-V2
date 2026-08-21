using System.Text;
using FormBuilderAppService.Data;
using FormBuilderAppService.Models.Identity;
using FormBuilderAppService.Pdf;
using FormBuilderAppService.Repositories;
using FormBuilderAppService.Repositories.Interfaces;
using FormBuilderAppService.Services;
using FormBuilderAppService.Services.Interfaces;
using FormBuilderAppService.Settings;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using MongoDB.Driver;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Version = "v1",
        Title = "FormBuilder API",
        Description = "API for managing forms using .NET 8 with Dapper and SQL Server"
    });

    // "Authorize" button in Swagger UI, so protected endpoints can be exercised there.
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Paste the token returned by POST /api/auth/login."
    });

    options.AddSecurityRequirement(document => new OpenApiSecurityRequirement
    {
        { new OpenApiSecuritySchemeReference("Bearer", document), new List<string>() }
    });
});

// Add CORS support
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", builder =>
    {
        builder.AllowAnyOrigin()
               .AllowAnyMethod()
               .AllowAnyHeader()
               // Let the browser read the generated PDF's file name.
               .WithExposedHeaders("Content-Disposition", "X-Pdf-Filename", "X-Pdf-Document-Count",
                                   "X-Pdf-Request-Id", "Retry-After");
    });
});

// MongoDB Configuration
builder.Services.Configure<MongoDbSettings>(
    builder.Configuration.GetSection("MongoDbSettings"));

builder.Services.AddSingleton<IMongoClient>(sp =>
{
    var settings = sp.GetRequiredService<IOptions<MongoDbSettings>>().Value;
    return new MongoClient(settings.ConnectionString);
});

builder.Services.AddSingleton<MongoDbContext>();

// ---------------------------------------------------------------------------
// Authentication: ASP.NET Core Identity (SQL Server) + JWT bearer tokens.
//
// Identity owns users, password hashing and roles. MongoDB is untouched by this and
// continues to own Forms, FormSubmissions and Resources.
// ---------------------------------------------------------------------------

builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection("Jwt"));
builder.Services.Configure<IdentitySeedSettings>(builder.Configuration.GetSection("IdentitySeed"));

var identityConnectionString = builder.Configuration.GetConnectionString("PracticeDB")
    ?? throw new InvalidOperationException("Connection string 'PracticeDB' not found.");

builder.Services.AddDbContext<AppIdentityDbContext>(options =>
    options.UseSqlServer(identityConnectionString));

builder.Services
    .AddIdentity<ApplicationUser, ApplicationRole>(options =>
    {
        // V1 keeps Identity's defaults deliberately - advanced password policy and
        // lockout tuning are V2 items. Only uniqueness is asserted, because login
        // accepts an email as the identifier and must resolve to one account.
        options.User.RequireUniqueEmail = true;
    })
    .AddEntityFrameworkStores<AppIdentityDbContext>()
    .AddDefaultTokenProviders();

var jwtSettings = builder.Configuration.GetSection("Jwt").Get<JwtSettings>() ?? new JwtSettings();

builder.Services
    .AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwtSettings.SecretKey ?? string.Empty)),

            ValidateIssuer = true,
            ValidIssuer = jwtSettings.Issuer,

            ValidateAudience = true,
            ValidAudience = jwtSettings.Audience,

            ValidateLifetime = true,

            // Default is 5 minutes of leeway, which lets an "expired" token keep working.
            ClockSkew = TimeSpan.Zero
        };
    });

builder.Services.AddAuthorization();

builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IUserManagementService, UserManagementService>();
builder.Services.AddScoped<IdentitySeeder>();

// Register Repositories and Services
builder.Services.AddScoped<IFormRepository, FormRepository>();
builder.Services.AddScoped<IFormService, FormService>();
builder.Services.AddScoped<IFormSubmissionRepository, FormSubmissionRepository>();
builder.Services.AddScoped<IFormSubmissionService, FormSubmissionService>();
builder.Services.AddScoped<IResourceRepository, ResourceRepository>();
builder.Services.AddScoped<IResourceService, ResourceService>();
builder.Services.AddScoped<ITenantRepository, TenantRepository>();
builder.Services.AddScoped<ITenantService, TenantService>();

// Reusable PDF generation module (Playwright + headless Chromium)
builder.Services.AddPdfRenderer(builder.Configuration);

var app = builder.Build();

// Bring the Identity schema up to date, then ensure the roles and seed accounts exist.
// Both run before the app serves a request, so a fresh database is immediately usable.
//
// Database.MigrateAsync() applies whatever migrations the database is missing and does
// nothing when it is already current. That makes the AspNet* tables create-if-not-exist
// on startup: a new machine only has to point at a database and run - no separate
// "Update-Database" or "dotnet ef database update" step. It runs exactly the same
// migrations from FormBuilderAppService/Migrations, so the schema is identical either
// way, and running the CLI/PMC commands by hand still works.
using (var scope = app.Services.CreateScope())
{
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();

    try
    {
        var db = scope.ServiceProvider.GetRequiredService<AppIdentityDbContext>();

        var pending = (await db.Database.GetPendingMigrationsAsync()).ToList();
        if (pending.Count > 0)
        {
            logger.LogInformation(
                "Applying {Count} Identity migration(s): {Migrations}",
                pending.Count, string.Join(", ", pending));

            await db.Database.MigrateAsync();

            logger.LogInformation("Identity schema is up to date.");
        }

        var seeder = scope.ServiceProvider.GetRequiredService<IdentitySeeder>();
        await seeder.SeedAsync();
    }
    catch (Exception ex)
    {
        // An unreachable database must not stop the whole API from starting. Token
        // validation needs no database at all, and the MongoDB-backed endpoints are
        // unaffected, so the rest of the application still works. Logins will fail
        // until SQL Server is reachable - which this log makes obvious, instead of the
        // process dying at startup with an unhandled SqlException.
        logger.LogError(ex,
            "Identity database setup failed. Check ConnectionStrings:PracticeDB. " +
            "Authentication will not work until this is resolved.");
    }
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Enable CORS - must be before UseHttpsRedirection
app.UseCors("AllowAll");

app.UseHttpsRedirection();

// Order matters: authentication establishes who the caller is, authorization then
// decides what they may do. Swapping these leaves every [Authorize] endpoint open.
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
