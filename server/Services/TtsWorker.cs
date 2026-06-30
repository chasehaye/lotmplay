using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using server.Data;
using server.Models;

namespace server.Services;

public class TtsWorker(TtsQueue queue, IServiceScopeFactory scopeFactory, IConfiguration config, ILogger<TtsWorker> logger)
    : BackgroundService
{
    private readonly HttpClient _http = new() { Timeout = TimeSpan.FromMinutes(30) };
    private const string TtsBaseUrl = "http://127.0.0.1:8765";

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        await WaitForTtsServer(ct);

        // Run stale job cleanup in background
        _ = CleanupStaleJobsLoop(ct);

        while (!ct.IsCancellationRequested)
        {
            var item = await queue.DequeueAsync(ct);
            await ProcessJob(item.JobId, ct);
        }
    }

    private async Task CleanupStaleJobsLoop(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            await Task.Delay(TimeSpan.FromHours(1), ct);
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var cutoff = DateTime.UtcNow.AddDays(-2);
                var stale = await db.TtsJobs
                    .Where(j => j.Status == TtsJobStatus.Pending && j.CreatedAt < cutoff)
                    .ToListAsync(ct);
                foreach (var job in stale)
                {
                    job.Status = TtsJobStatus.Failed;
                    job.Error = "Job expired after 2 days in pending state.";
                }
                if (stale.Count > 0)
                {
                    await db.SaveChangesAsync(ct);
                    logger.LogInformation("Expired {Count} stale pending jobs.", stale.Count);
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error during stale job cleanup.");
            }
        }
    }

    private async Task WaitForTtsServer(CancellationToken ct)
    {
        logger.LogInformation("Waiting for TTS server at {Url}...", TtsBaseUrl);
        while (!ct.IsCancellationRequested)
        {
            try
            {
                var res = await _http.GetAsync($"{TtsBaseUrl}/health", ct);
                if (res.IsSuccessStatusCode)
                {
                    logger.LogInformation("TTS server is ready.");
                    return;
                }
            }
            catch
            {
                // Not up yet
            }
            await Task.Delay(2000, ct);
        }
    }

    private async Task ProcessJob(int jobId, CancellationToken ct)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var job = await db.TtsJobs.FindAsync([jobId], ct);
        if (job is null) return;

        job.Status = TtsJobStatus.Processing;
        await db.SaveChangesAsync(ct);

        try
        {
            var uploadsRoot = config["Uploads:Path"]
                ?? Path.Combine(Directory.GetCurrentDirectory(), "uploads");
            var audioDir = Path.Combine(uploadsRoot, job.AudiobookId.ToString(), "audio");
            var textFile = Path.Combine(audioDir, $"track_{job.TrackNumber:D3}.txt");
            var outFile = Path.Combine(audioDir, $"track_{job.TrackNumber:D3}.wav");

            if (!File.Exists(textFile))
                throw new Exception($"Text file not found: {textFile}");

            var payload = JsonSerializer.Serialize(new
            {
                text_file = textFile,
                out_file = outFile,
            });

            var response = await _http.PostAsync(
                $"{TtsBaseUrl}/generate",
                new StringContent(payload, Encoding.UTF8, "application/json"),
                ct);

            if (!response.IsSuccessStatusCode)
            {
                var err = await response.Content.ReadAsStringAsync(ct);
                throw new Exception($"TTS server error {response.StatusCode}: {err}");
            }

            var track = new AudioFile
            {
                AudiobookId = job.AudiobookId,
                Title = job.ChapterTitle,
                TrackNumber = job.TrackNumber,
                Duration = 0,
                FileUrl = $"/files/{job.AudiobookId}/audio/track_{job.TrackNumber:D3}.wav",
            };
            db.AudioFiles.Add(track);

            job.Status = TtsJobStatus.Done;
            job.OutputPath = outFile;
            await db.SaveChangesAsync(ct);

            logger.LogInformation("TTS job {JobId} completed: {File}", jobId, outFile);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "TTS job {JobId} failed", jobId);
            job.Status = TtsJobStatus.Failed;
            job.Error = ex.Message;
            await db.SaveChangesAsync(ct);
        }
    }
}
