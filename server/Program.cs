using Microsoft.EntityFrameworkCore;
using server.Data;
using server.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.ReferenceHandler =
            System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
        o.JsonSerializerOptions.Converters.Add(
            new System.Text.Json.Serialization.JsonStringEnumConverter());
    });
builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(o =>
{
    o.MultipartBodyLengthLimit = 500_000_000; // 500MB
});
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

var corsOrigins = builder.Configuration["Cors:Origins"]
    ?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    ?? ["http://localhost:5173"];

builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins(corsOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()));

builder.Services.AddSingleton<TtsQueue>();
builder.Services.AddSingleton<PdfChapterParser>();
builder.Services.AddSingleton<EpubChapterParser>();
builder.Services.AddHostedService<TtsWorker>();

var app = builder.Build();

// On startup: fail any jobs that were interrupted mid-processing
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var interrupted = await db.TtsJobs
        .Where(j => j.Status == server.Models.TtsJobStatus.Processing || j.Status == server.Models.TtsJobStatus.Pending)
        .ToListAsync();
    foreach (var job in interrupted)
    {
        job.Error = job.Status == server.Models.TtsJobStatus.Processing
            ? "Server restarted while job was processing."
            : "Server restarted before job could be processed.";
        job.Status = server.Models.TtsJobStatus.Failed;
    }
    if (interrupted.Count > 0)
        await db.SaveChangesAsync();
}

app.UseCors();
app.UseMiddleware<server.Middleware.AuthMiddleware>();

// Serve uploaded audio files at /files/{audiobookId}/audio/{filename}
var uploadsPath = builder.Configuration["Uploads:Path"]
    ?? Path.Combine(Directory.GetCurrentDirectory(), "uploads");
Directory.CreateDirectory(uploadsPath);
var contentTypeProvider = new Microsoft.AspNetCore.StaticFiles.FileExtensionContentTypeProvider();
contentTypeProvider.Mappings[".mp3"] = "audio/mpeg";
contentTypeProvider.Mappings[".wav"] = "audio/wav";
contentTypeProvider.Mappings[".m4a"] = "audio/mp4";
contentTypeProvider.Mappings[".m4b"] = "audio/mp4";
contentTypeProvider.Mappings[".ogg"] = "audio/ogg";
contentTypeProvider.Mappings[".flac"] = "audio/flac";

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(uploadsPath),
    RequestPath = "/files",
    ContentTypeProvider = contentTypeProvider,
    OnPrepareResponse = ctx =>
    {
        var origin = ctx.Context.Request.Headers.Origin.ToString();
        if (corsOrigins.Contains(origin))
            ctx.Context.Response.Headers.Append("Access-Control-Allow-Origin", origin);
    },
});

app.MapControllers();
app.Run();
