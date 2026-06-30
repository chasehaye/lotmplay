using Microsoft.EntityFrameworkCore;
using server.Models;

namespace server.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Audiobook> Audiobooks => Set<Audiobook>();
    public DbSet<AudioFile> AudioFiles => Set<AudioFile>();
    public DbSet<TtsJob> TtsJobs => Set<TtsJob>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AudioFile>()
            .HasOne(f => f.Audiobook)
            .WithMany(b => b.AudioFiles)
            .HasForeignKey(f => f.AudiobookId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
